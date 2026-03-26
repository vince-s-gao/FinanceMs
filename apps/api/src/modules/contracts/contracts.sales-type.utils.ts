import type { PrismaService } from "../../prisma/prisma.service";
import { normalizeText } from "../../common/utils/tabular.utils";
import {
  registerDictionaryLookup,
  resolveDictionaryCodeByText,
} from "./contracts.lookup.utils";
import { isSalesContractType } from "./contracts.type.utils";

export type SalesContractTypeContext = {
  codes: string[];
  codeByLookup: Map<string, string>;
};

export async function resolveSalesContractTypeContext(args: {
  prisma: PrismaService;
  includeDisabled?: boolean;
  fallbackCodes?: string[];
}): Promise<SalesContractTypeContext> {
  const rows = await args.prisma.dictionary.findMany({
    where: {
      type: "CONTRACT_TYPE",
      ...(args.includeDisabled ? {} : { isEnabled: true }),
    },
    select: { code: true, name: true, value: true },
  });

  const codeByLookup = new Map<string, string>();
  rows.forEach((row) => registerDictionaryLookup(codeByLookup, row));

  const detected = rows
    .filter((row) => isSalesContractType([row.code, row.value || ""]))
    .map((row) => normalizeText(row.code).toUpperCase())
    .filter(Boolean);
  const fallback = (args.fallbackCodes || ["SALES"])
    .map((item) => normalizeText(item).toUpperCase())
    .filter(Boolean);

  return {
    codes: [...new Set([...detected, ...fallback])],
    codeByLookup,
  };
}

export function isSalesContractByContext(args: {
  contractType?: string | null;
  context: SalesContractTypeContext;
}): boolean {
  const raw = normalizeText(args.contractType || "");
  if (!raw) return false;

  const normalized = raw.toUpperCase();
  if (args.context.codes.includes(normalized)) return true;

  const mappedCode = resolveDictionaryCodeByText(
    args.context.codeByLookup,
    raw,
  );
  if (!mappedCode) return false;

  return args.context.codes.includes(normalizeText(mappedCode).toUpperCase());
}
