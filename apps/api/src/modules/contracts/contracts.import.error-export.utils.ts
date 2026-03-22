import { toCsv, toXlsxBuffer } from "../../common/utils/tabular.utils";
import { toImportErrors } from "./contracts.lookup.utils";

export type ContractImportErrorItem = {
  row: number;
  message: string;
};

export const CONTRACT_IMPORT_ERROR_HEADERS = ["行号", "错误信息"] as const;

export function resolveContractImportErrors(
  raw: unknown,
): ContractImportErrorItem[] {
  return toImportErrors(raw);
}

export function buildImportErrorCsvExport(
  id: string,
  errors: ContractImportErrorItem[],
) {
  return {
    fileName: `contracts-import-errors-${id}.csv`,
    csv: toCsv(
      [...CONTRACT_IMPORT_ERROR_HEADERS],
      errors.map((item) => [item.row, item.message]),
    ),
  };
}

export function buildImportErrorExcelExport(
  id: string,
  errors: ContractImportErrorItem[],
) {
  return {
    fileName: `contracts-import-errors-${id}.xlsx`,
    buffer: toXlsxBuffer(
      [...CONTRACT_IMPORT_ERROR_HEADERS],
      errors.map((item) => [item.row, item.message]),
    ),
  };
}
