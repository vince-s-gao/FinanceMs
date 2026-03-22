import type {
  ImportContractResult,
  ImportExecutionContext,
  PreparedImportRow,
} from "./contracts.import.types";

type EnsureCustomerForImport = (
  customerName: string,
  customerIdByName: Map<string, string>,
  defaultCustomerType: string,
  operatorId?: string,
  options?: { visibleInCustomerList?: boolean },
) => Promise<string>;

type EnsureContractTypeForImport = (
  contractTypeText: string,
  resolvedContractTypeCode: string | undefined,
  contractTypeCodeByLookup: Map<string, string>,
  sortOrderState: { next: number },
) => Promise<string>;

type ResolveIsSalesByContractType = (args: {
  contractTypeCode?: string;
  contractTypeText?: string;
}) => Promise<boolean>;

type SyncCounterpartyByContractType = (args: {
  contractTypeCode?: string;
  contractTypeText?: string;
  counterpartyName?: string;
  supplierIdByName: Map<string, string>;
  defaultSupplierType: string;
  isSalesContractType?: boolean;
}) => Promise<void>;

type UpsertImportedContract = (args: {
  row: PreparedImportRow;
  customerId: string;
  contractTypeCode: string;
}) => Promise<void>;

export type ImportRowHandlers = {
  ensureContractType: (args: {
    contractTypeText: string;
    resolvedContractTypeCode?: string;
    contractTypeCodeByLookup: Map<string, string>;
    sortOrderState: { next: number };
  }) => Promise<string>;
  resolveIsSalesContractType: (args: {
    contractTypeCode?: string;
    contractTypeText?: string;
  }) => Promise<boolean>;
  ensureCustomer: (args: {
    customerName: string;
    customerIdByName: Map<string, string>;
    defaultCustomerType: string;
    operatorId?: string;
    visibleInCustomerList: boolean;
  }) => Promise<string>;
  syncCounterparty: (args: {
    contractTypeCode?: string;
    contractTypeText?: string;
    counterpartyName?: string;
    supplierIdByName: Map<string, string>;
    defaultSupplierType: string;
    isSalesContractType?: boolean;
  }) => Promise<void>;
  upsertContract: (args: {
    row: PreparedImportRow;
    customerId: string;
    contractTypeCode: string;
  }) => Promise<void>;
};

export function createImportRowHandlersByDeps(args: {
  ensureContractTypeForImport: EnsureContractTypeForImport;
  resolveIsSalesByContractType: ResolveIsSalesByContractType;
  ensureCustomerForImport: EnsureCustomerForImport;
  syncCounterpartyByContractType: SyncCounterpartyByContractType;
  upsertImportedContract: UpsertImportedContract;
}): ImportRowHandlers {
  return {
    ensureContractType: (params) =>
      args.ensureContractTypeForImport(
        params.contractTypeText,
        params.resolvedContractTypeCode,
        params.contractTypeCodeByLookup,
        params.sortOrderState,
      ),
    resolveIsSalesContractType: (params) =>
      args.resolveIsSalesByContractType({
        contractTypeCode: params.contractTypeCode,
        contractTypeText: params.contractTypeText,
      }),
    ensureCustomer: (params) =>
      args.ensureCustomerForImport(
        params.customerName,
        params.customerIdByName,
        params.defaultCustomerType,
        params.operatorId,
        { visibleInCustomerList: params.visibleInCustomerList },
      ),
    syncCounterparty: (params) =>
      args.syncCounterpartyByContractType({
        contractTypeCode: params.contractTypeCode,
        contractTypeText: params.contractTypeText,
        counterpartyName: params.counterpartyName,
        supplierIdByName: params.supplierIdByName,
        defaultSupplierType: params.defaultSupplierType,
        isSalesContractType: params.isSalesContractType,
      }),
    upsertContract: (params) =>
      args.upsertImportedContract({
        row: params.row,
        customerId: params.customerId,
        contractTypeCode: params.contractTypeCode,
      }),
  };
}

export async function processImportRowWithHandlers(
  row: PreparedImportRow,
  context: ImportExecutionContext,
  handlers: ImportRowHandlers,
) {
  const contractTypeCode = await handlers.ensureContractType({
    contractTypeText: row.contractTypeText,
    resolvedContractTypeCode: row.contractData.contractType,
    contractTypeCodeByLookup: context.contractTypeCodeByLookup,
    sortOrderState: context.contractTypeSortOrderState,
  });

  const isSalesContractType = await handlers.resolveIsSalesContractType({
    contractTypeCode,
    contractTypeText: row.contractTypeText,
  });

  const customerId = await handlers.ensureCustomer({
    customerName: row.customerName,
    customerIdByName: context.customerIdByName,
    defaultCustomerType: context.defaultCustomerType,
    operatorId: context.operatorId,
    visibleInCustomerList: isSalesContractType,
  });

  await handlers.syncCounterparty({
    contractTypeCode,
    contractTypeText: row.contractTypeText,
    counterpartyName: row.customerName,
    supplierIdByName: context.supplierIdByName,
    defaultSupplierType: context.defaultSupplierType,
    isSalesContractType,
  });

  await handlers.upsertContract({
    row,
    customerId,
    contractTypeCode,
  });
}

export async function executeImportRows(args: {
  rows: PreparedImportRow[];
  processRow: (row: PreparedImportRow) => Promise<void>;
  result: ImportContractResult;
}) {
  for (const row of args.rows) {
    try {
      await args.processRow(row);
      args.result.success += 1;
    } catch (error: unknown) {
      args.result.failed += 1;
      const message = error instanceof Error ? error.message : "导入失败";
      args.result.errors.push({ row: row.row, message });
    }
  }
}
