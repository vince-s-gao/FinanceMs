type CodeRecord = { code: string };

export async function resolveDefaultCustomerTypeForImportByDeps(args: {
  findPreferred: () => Promise<CodeRecord | null>;
  findFallback: () => Promise<CodeRecord | null>;
  defaultCode?: string;
}): Promise<string> {
  const preferred = await args.findPreferred();
  if (preferred?.code) {
    return preferred.code;
  }

  const fallback = await args.findFallback();
  return fallback?.code || args.defaultCode || "ENTERPRISE";
}

export function resolveDefaultSupplierTypeForAutoCreate(
  defaultCode = "CORPORATE",
): string {
  return defaultCode;
}
