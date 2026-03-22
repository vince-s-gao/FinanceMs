import { normalizeText } from "../../common/utils/tabular.utils";
import { isSalesContractType } from "./contracts.type.utils";

type ContractTypeDictionaryItem = {
  name?: string | null;
  value?: string | null;
};

export async function resolveContractTypeHintsByCodeByDeps(args: {
  contractTypeCode?: string;
  findContractTypeByCode: (
    contractTypeCode: string,
  ) => Promise<ContractTypeDictionaryItem | null>;
}): Promise<string[]> {
  if (!args.contractTypeCode) return [];
  const hints: string[] = [args.contractTypeCode];
  const dictionaryItem = await args.findContractTypeByCode(
    args.contractTypeCode,
  );
  if (dictionaryItem?.name) hints.push(dictionaryItem.name);
  if (dictionaryItem?.value) hints.push(dictionaryItem.value);
  return hints;
}

export async function resolveIsSalesByContractTypeByDeps(args: {
  contractTypeCode?: string;
  contractTypeText?: string;
  resolveHintsByCode: (contractTypeCode?: string) => Promise<string[]>;
}): Promise<boolean> {
  const contractTypeHints = [
    ...(await args.resolveHintsByCode(args.contractTypeCode)),
    ...(args.contractTypeText ? [args.contractTypeText] : []),
  ];
  return isSalesContractType(contractTypeHints);
}

export async function syncCounterpartyByContractTypeByDeps(args: {
  contractTypeCode?: string;
  contractTypeText?: string;
  counterpartyName?: string;
  supplierIdByName: Map<string, string>;
  defaultSupplierType: string;
  isSalesContractType?: boolean;
  resolveIsSalesContractType: (params: {
    contractTypeCode?: string;
    contractTypeText?: string;
  }) => Promise<boolean>;
  ensureSupplierForCounterparty: (
    supplierName: string,
    supplierIdByName: Map<string, string>,
    defaultSupplierType: string,
  ) => Promise<string>;
}) {
  const counterpartyName = normalizeText(args.counterpartyName || "");
  if (!counterpartyName) return;

  const isSalesContractType =
    args.isSalesContractType ??
    (await args.resolveIsSalesContractType({
      contractTypeCode: args.contractTypeCode,
      contractTypeText: args.contractTypeText,
    }));

  if (isSalesContractType) return;

  await args.ensureSupplierForCounterparty(
    counterpartyName,
    args.supplierIdByName,
    args.defaultSupplierType,
  );
}
