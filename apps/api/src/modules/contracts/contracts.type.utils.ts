import { normalizeText } from "../../common/utils/tabular.utils";

export function isSalesContractType(values: string[]): boolean {
  return values.some((value) => {
    const normalized = normalizeText(value).toUpperCase();
    return normalized.includes("SALES") || value.includes("销售");
  });
}

export function toSuggestedContractTypeCode(
  contractTypeText: string,
): string | null {
  const normalized = normalizeText(contractTypeText)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return null;
  return normalized.length > 40 ? normalized.slice(0, 40) : normalized;
}

export async function buildContractTypeCandidateCodes(args: {
  normalizedContractTypeText: string;
  generateAutoCode: () => Promise<string>;
  autoRetryCount?: number;
}): Promise<string[]> {
  const candidateCodes: string[] = [];
  const suggestedCode = toSuggestedContractTypeCode(
    args.normalizedContractTypeText,
  );
  if (suggestedCode) {
    candidateCodes.push(suggestedCode);
  }

  const autoRetryCount = args.autoRetryCount ?? 8;
  for (let i = 0; i < autoRetryCount; i += 1) {
    candidateCodes.push(await args.generateAutoCode());
  }

  return candidateCodes;
}
