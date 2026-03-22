import { BadRequestException, ConflictException } from "@nestjs/common";
import { normalizeText } from "../../common/utils/tabular.utils";
import {
  registerDictionaryLookup,
  resolveDictionaryCodeByText,
} from "./contracts.lookup.utils";

type ContractTypeLookupItem = {
  code: string;
  name?: string | null;
  value?: string | null;
};

export async function ensureImportContractTypeByDeps(args: {
  contractTypeText: string;
  resolvedContractTypeCode?: string;
  contractTypeCodeByLookup: Map<string, string>;
  sortOrderState: { next: number };
  findExistingByText: (
    normalizedContractTypeText: string,
  ) => Promise<ContractTypeLookupItem | null>;
  createByCode: (params: {
    code: string;
    normalizedContractTypeText: string;
    sortOrder: number;
  }) => Promise<ContractTypeLookupItem>;
  buildCandidateCodes: (
    normalizedContractTypeText: string,
  ) => Promise<string[]>;
  isCodeConflict: (error: unknown) => boolean;
}): Promise<string> {
  const normalizedContractTypeText = normalizeText(args.contractTypeText);
  if (!normalizedContractTypeText) {
    throw new BadRequestException("合同类型不能为空");
  }

  if (args.resolvedContractTypeCode) {
    registerDictionaryLookup(args.contractTypeCodeByLookup, {
      code: args.resolvedContractTypeCode,
      name: normalizedContractTypeText,
      value: normalizedContractTypeText,
    });
    return args.resolvedContractTypeCode;
  }

  const cachedCode = resolveDictionaryCodeByText(
    args.contractTypeCodeByLookup,
    normalizedContractTypeText,
  );
  if (cachedCode) return cachedCode;

  const existing = await args.findExistingByText(normalizedContractTypeText);
  if (existing) {
    registerDictionaryLookup(args.contractTypeCodeByLookup, existing);
    return existing.code;
  }

  const candidateCodes = await args.buildCandidateCodes(
    normalizedContractTypeText,
  );
  for (const code of candidateCodes) {
    try {
      const created = await args.createByCode({
        code,
        normalizedContractTypeText,
        sortOrder: args.sortOrderState.next,
      });
      args.sortOrderState.next += 1;
      registerDictionaryLookup(args.contractTypeCodeByLookup, created);
      return created.code;
    } catch (error) {
      if (args.isCodeConflict(error)) continue;
      throw error;
    }
  }

  throw new ConflictException(
    `自动创建合同类型失败: ${normalizedContractTypeText}`,
  );
}
