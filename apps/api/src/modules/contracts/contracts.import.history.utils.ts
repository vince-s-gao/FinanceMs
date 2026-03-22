import type { ImportHistoryItem } from "./contracts.import.types";
import { toImportErrors } from "./contracts.lookup.utils";

type ImportLogRecord = {
  id: string;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  allowPartial: boolean;
  errors: unknown;
  createdAt: Date;
  operator?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export function clampImportHistoryLimit(limit: number): number {
  return Math.min(Math.max(limit, 1), 50);
}

export function mapImportLogToHistoryItem(
  item: ImportLogRecord,
): ImportHistoryItem {
  return {
    id: item.id,
    fileName: item.fileName,
    total: item.total,
    success: item.success,
    failed: item.failed,
    allowPartial: item.allowPartial,
    errors: toImportErrors(item.errors),
    createdAt: item.createdAt,
    operator: item.operator,
  };
}
