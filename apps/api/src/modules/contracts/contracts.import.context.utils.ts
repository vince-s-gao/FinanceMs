import {
  resolveDefaultCustomerTypeForImportByDeps,
  resolveDefaultSupplierTypeForAutoCreate,
} from "./contracts.import.defaults.utils";
import type {
  ImportCsvOptions,
  ImportExecutionContext,
  PreparedImportResult,
} from "./contracts.import.types";

type CodeRecord = { code: string };

export async function resolveDefaultCustomerTypeInContextByDeps(args: {
  findPreferred: () => Promise<CodeRecord | null>;
  findFallback: () => Promise<CodeRecord | null>;
  defaultCode?: string;
}): Promise<string> {
  return resolveDefaultCustomerTypeForImportByDeps({
    findPreferred: args.findPreferred,
    findFallback: args.findFallback,
    defaultCode: args.defaultCode || "ENTERPRISE",
  });
}

export async function createImportExecutionContextByDeps(args: {
  prepared: PreparedImportResult;
  options?: ImportCsvOptions;
  defaultCustomerType: string;
  nextContractTypeSortOrder: number;
  defaultFileName?: string;
  defaultSupplierType?: string;
}): Promise<ImportExecutionContext> {
  return {
    allowPartial: !!args.options?.allowPartial,
    fileName:
      args.options?.fileName || args.defaultFileName || "contracts-import.csv",
    operatorId: args.options?.operatorId,
    defaultCustomerType: args.defaultCustomerType,
    defaultSupplierType:
      args.defaultSupplierType || resolveDefaultSupplierTypeForAutoCreate(),
    customerIdByName: new Map<string, string>(),
    supplierIdByName: new Map<string, string>(),
    contractTypeCodeByLookup: new Map(args.prepared.contractTypeCodeByLookup),
    contractTypeSortOrderState: {
      next: args.nextContractTypeSortOrder,
    },
  };
}
