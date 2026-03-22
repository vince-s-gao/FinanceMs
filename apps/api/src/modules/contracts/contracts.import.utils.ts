import { BadRequestException } from "@nestjs/common";
import {
  getFileExtension,
  normalizeHeader,
  normalizeText,
  parseTabularBuffer,
  resolveHeaderIndex as resolveHeaderIndexStrict,
} from "../../common/utils/tabular.utils";
import { IMPORT_HEADER_ALIASES } from "./contracts.constants";

export type ContractImportHeaderIndexes = {
  contractNoIdx?: number;
  nameIdx?: number;
  customerNameIdx?: number;
  signingEntityIdx?: number;
  contractTypeIdx?: number;
  amountIdx?: number;
  signDateIdx?: number;
  endDateIdx?: number;
};

function resolveHeaderIndexWithTolerance(
  headers: string[],
  aliases: readonly string[],
): number | undefined {
  const strictIndex = resolveHeaderIndexStrict(headers, aliases);
  if (strictIndex !== undefined) return strictIndex;

  const normalizedHeaders = headers.map((header) => normalizeHeader(header));
  const normalizedAliases = aliases
    .map((alias) => normalizeHeader(alias))
    .filter(Boolean);

  // 容错匹配：支持“签署日期（必填）”/“sign_date_required”等扩展写法
  for (let i = 0; i < normalizedHeaders.length; i += 1) {
    const header = normalizedHeaders[i];
    if (!header) continue;
    const matched = normalizedAliases.some(
      (alias) => header.includes(alias) || alias.includes(header),
    );
    if (matched) return i;
  }

  // 原始文本兜底（忽略大小写）
  for (const alias of aliases) {
    const idx = headers.findIndex(
      (header) =>
        normalizeText(header).toLowerCase() ===
        normalizeText(alias).toLowerCase(),
    );
    if (idx >= 0) return idx;
  }

  return undefined;
}

export function parseContractImportRows(
  fileBuffer: Buffer,
  fileName?: string,
): string[][] {
  const rows = parseTabularBuffer(fileBuffer, fileName);
  const extension = getFileExtension(fileName);
  if ((extension === ".xlsx" || extension === ".xls") && rows.length === 0) {
    throw new BadRequestException("Excel 内容为空");
  }
  return rows;
}

export function resolveContractImportHeaderIndexes(
  headers: string[],
): ContractImportHeaderIndexes {
  return {
    contractNoIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.contractNo,
    ),
    nameIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.name,
    ),
    customerNameIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.customerName,
    ),
    signingEntityIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.signingEntity,
    ),
    contractTypeIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.contractType,
    ),
    amountIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.amount,
    ),
    signDateIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.signDate,
    ),
    endDateIdx: resolveHeaderIndexWithTolerance(
      headers,
      IMPORT_HEADER_ALIASES.endDate,
    ),
  };
}

export function collectMissingContractImportHeaders(
  indexes: ContractImportHeaderIndexes,
): string[] {
  const missingHeaders: string[] = [];
  if (indexes.contractNoIdx === undefined)
    missingHeaders.push("合同编号/contract_no");
  if (indexes.nameIdx === undefined) missingHeaders.push("合同名称/name");
  if (indexes.customerNameIdx === undefined)
    missingHeaders.push("客户名称/customer_name");
  if (indexes.signingEntityIdx === undefined)
    missingHeaders.push("公司签约主体/signing_entity");
  if (indexes.contractTypeIdx === undefined)
    missingHeaders.push("合同类型/contract_type");
  if (indexes.amountIdx === undefined) missingHeaders.push("合同金额/amount");
  if (indexes.signDateIdx === undefined)
    missingHeaders.push("签署日期/sign_date");
  return missingHeaders;
}
