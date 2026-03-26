import { normalizeText } from "../../common/utils/tabular.utils";

const NON_SALES_TYPE_HINTS = [
  "NDA",
  "TS",
  "FA",
  "OTHER",
  "采购",
  "PURCHASE",
  "付款",
  "PAYMENT",
  "应付",
];

const SALES_TYPE_HINTS = ["SALES", "SALE", "销售", "应收", "RECEIVABLE"];

export function isNonSalesContractType(value: string): boolean {
  const normalized = normalizeText(value).toUpperCase();
  if (!normalized) return false;
  return NON_SALES_TYPE_HINTS.some((hint) => normalized.includes(hint));
}

export function isSalesContractType(values: string[]): boolean {
  const normalizedValues = values
    .map((value) => normalizeText(value).toUpperCase())
    .filter(Boolean);

  if (normalizedValues.length === 0) return false;

  const matchesNonSales = normalizedValues.some((value) =>
    isNonSalesContractType(value),
  );
  if (matchesNonSales) return false;

  return normalizedValues.some((value) =>
    SALES_TYPE_HINTS.some((hint) => value.includes(hint)),
  );
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
