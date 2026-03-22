import type { Prisma } from "@prisma/client";
import type { ImportLogPayload } from "./contracts.import.types";

export function buildContractImportLogCreateData(
  payload: ImportLogPayload,
): Prisma.ContractImportLogUncheckedCreateInput {
  return {
    fileName: payload.fileName,
    total: payload.total,
    success: payload.success,
    failed: payload.failed,
    allowPartial: payload.allowPartial,
    errors: payload.errors as unknown as Prisma.InputJsonValue,
    operatorId: payload.operatorId,
  };
}
