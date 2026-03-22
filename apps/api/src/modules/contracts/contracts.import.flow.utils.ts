import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { formatDateOnly } from "./contracts.constants";
import { executeImportRows } from "./contracts.import.execute.utils";
import type {
  ImportContractResult,
  ImportExecutionContext,
  ImportLogPayload,
  PreparedImportResult,
  PreparedImportRow,
} from "./contracts.import.types";

type ExistingContractSnapshot = {
  name: string;
  customerId: string;
  signingEntity: string;
  contractType: string | null;
  amountWithTax: unknown;
  amountWithoutTax: unknown;
  taxRate: unknown;
  signDate: Date;
  endDate: Date | null;
  isDeleted: boolean;
};

type ExistingContractWithId = ExistingContractSnapshot & { id: string };

export type UpsertImportedContract = (args: {
  row: PreparedImportRow;
  customerId: string;
  contractTypeCode: string;
}) => Promise<void>;

export type SaveImportLog = (args: ImportLogPayload) => Promise<unknown>;

export function createImportResult(
  prepared: PreparedImportResult,
): ImportContractResult {
  return {
    total: prepared.total,
    success: 0,
    failed: prepared.errors.length,
    errors: [...prepared.errors],
  };
}

export async function validateImportPrecheckOrThrow(args: {
  prepared: PreparedImportResult;
  context: ImportExecutionContext;
  saveImportLog: SaveImportLog;
}) {
  const { prepared, context, saveImportLog } = args;
  if (prepared.errors.length > 0 && !context.allowPartial) {
    await saveImportLog({
      fileName: context.fileName,
      total: prepared.total,
      success: 0,
      failed: prepared.errors.length,
      allowPartial: false,
      errors: prepared.errors,
      operatorId: context.operatorId,
    });
    throw new BadRequestException({
      message: `导入校验失败：共 ${prepared.total} 行，异常 ${prepared.errors.length} 行。请先修复错误，或开启“忽略错误并仅导入有效行”。`,
      details: {
        errors: prepared.errors.slice(0, 20),
      },
    });
  }
}

export async function runImportCsvFlowByDeps(args: {
  prepared: PreparedImportResult;
  context: ImportExecutionContext;
  processRow: (row: PreparedImportRow) => Promise<void>;
  saveImportLog: SaveImportLog;
}): Promise<ImportContractResult> {
  await validateImportPrecheckOrThrow({
    prepared: args.prepared,
    context: args.context,
    saveImportLog: args.saveImportLog,
  });

  const result = createImportResult(args.prepared);
  await executeImportRows({
    rows: args.prepared.validRows,
    result,
    processRow: args.processRow,
  });

  await args.saveImportLog({
    fileName: args.context.fileName,
    total: result.total,
    success: result.success,
    failed: result.failed,
    allowPartial: args.context.allowPartial,
    errors: result.errors,
    operatorId: args.context.operatorId,
  });

  return result;
}

export function buildContractUpdateDataForImport(args: {
  existingContract: ExistingContractSnapshot;
  row: PreparedImportRow;
  customerId: string;
  contractTypeCode: string;
}): Prisma.ContractUpdateInput {
  const { existingContract, row, customerId, contractTypeCode } = args;
  const nextAmount = Number(row.contractData.amountWithTax);
  const nextSignDate = row.contractData.signDate;
  const nextEndDate = row.contractData.endDate || null;
  const updateData: Prisma.ContractUpdateInput = {};

  if (existingContract.name !== row.contractData.name) {
    updateData.name = row.contractData.name;
  }
  if (existingContract.customerId !== customerId) {
    updateData.customer = { connect: { id: customerId } };
  }
  if (existingContract.signingEntity !== row.contractData.signingEntity) {
    updateData.signingEntity = row.contractData.signingEntity;
  }
  if (existingContract.contractType !== contractTypeCode) {
    updateData.contractType = contractTypeCode;
  }
  if (Number(existingContract.amountWithTax) !== nextAmount) {
    updateData.amountWithTax = nextAmount;
  }
  if (Number(existingContract.amountWithoutTax) !== nextAmount) {
    updateData.amountWithoutTax = nextAmount;
  }
  if (Number(existingContract.taxRate ?? 0) !== 0) {
    updateData.taxRate = 0;
  }
  if (formatDateOnly(existingContract.signDate) !== nextSignDate) {
    updateData.signDate = new Date(nextSignDate);
  }
  if (formatDateOnly(existingContract.endDate) !== (nextEndDate || "")) {
    updateData.endDate = nextEndDate ? new Date(nextEndDate) : null;
  }
  if (existingContract.isDeleted) {
    updateData.isDeleted = false;
  }

  return updateData;
}

export async function upsertImportedContractByDeps(args: {
  row: PreparedImportRow;
  customerId: string;
  contractTypeCode: string;
  findExistingByContractNo: (
    contractNo: string,
  ) => Promise<ExistingContractWithId | null>;
  updateExisting: (
    id: string,
    data: Prisma.ContractUpdateInput,
  ) => Promise<unknown>;
  createNew: (args: {
    row: PreparedImportRow;
    customerId: string;
    contractTypeCode: string;
  }) => Promise<void>;
}) {
  const existingContract = await args.findExistingByContractNo(
    args.row.contractData.contractNo,
  );

  if (!existingContract) {
    await args.createNew({
      row: args.row,
      customerId: args.customerId,
      contractTypeCode: args.contractTypeCode,
    });
    return;
  }

  const updateData = buildContractUpdateDataForImport({
    existingContract,
    row: args.row,
    customerId: args.customerId,
    contractTypeCode: args.contractTypeCode,
  });

  if (Object.keys(updateData).length > 0) {
    await args.updateExisting(existingContract.id, updateData);
  }
}

export function createUpsertImportedContractHandlerByDeps(args: {
  findExistingByContractNo: (
    contractNo: string,
  ) => Promise<ExistingContractWithId | null>;
  updateExisting: (
    id: string,
    data: Prisma.ContractUpdateInput,
  ) => Promise<unknown>;
  createNew: (args: {
    row: PreparedImportRow;
    customerId: string;
    contractTypeCode: string;
  }) => Promise<void>;
}): UpsertImportedContract {
  return async ({ row, customerId, contractTypeCode }) =>
    upsertImportedContractByDeps({
      row,
      customerId,
      contractTypeCode,
      findExistingByContractNo: args.findExistingByContractNo,
      updateExisting: args.updateExisting,
      createNew: args.createNew,
    });
}
