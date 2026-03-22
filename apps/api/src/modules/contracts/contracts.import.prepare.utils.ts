import { BadRequestException } from "@nestjs/common";
import { normalizeText } from "../../common/utils/tabular.utils";
import { toDateString, toNumber } from "./contracts.constants";
import {
  collectMissingContractImportHeaders,
  parseContractImportRows,
  resolveContractImportHeaderIndexes,
} from "./contracts.import.utils";
import type { ContractImportHeaderIndexes } from "./contracts.import.utils";
import type {
  ImportPreviewResult,
  PreparedImportResult,
  PreparedImportRow,
} from "./contracts.import.types";
import {
  registerDictionaryLookup,
  resolveDictionaryCodeByText,
} from "./contracts.lookup.utils";

type ImportRowError = { row: number; message: string };

export function buildPreparedImportRows(args: {
  rows: string[][];
  headerIndexes: ContractImportHeaderIndexes;
  contractTypeCodeByLookup: Map<string, string>;
  normalizeContractNo: (value: string) => string;
  defaultSigningEntity?: string;
}): { validRows: PreparedImportRow[]; errors: ImportRowError[] } {
  const errors: ImportRowError[] = [];
  const validRows: PreparedImportRow[] = [];

  for (let i = 1; i < args.rows.length; i += 1) {
    const rowNumber = i + 1;
    const cells = args.rows[i];
    const getByIndex = (idx?: number) =>
      normalizeText(idx === undefined ? "" : cells[idx] || "");

    const contractNo = args.normalizeContractNo(
      getByIndex(args.headerIndexes.contractNoIdx),
    );
    const name = getByIndex(args.headerIndexes.nameIdx);
    const customerName = getByIndex(args.headerIndexes.customerNameIdx);
    const signingEntity =
      getByIndex(args.headerIndexes.signingEntityIdx) ||
      args.defaultSigningEntity ||
      "InfFinanceMs";
    const contractTypeRaw = getByIndex(args.headerIndexes.contractTypeIdx);
    const amount = toNumber(getByIndex(args.headerIndexes.amountIdx));
    const signDate = toDateString(getByIndex(args.headerIndexes.signDateIdx));
    const endDate = toDateString(getByIndex(args.headerIndexes.endDateIdx));

    if (!contractNo) {
      errors.push({ row: rowNumber, message: "合同编号不能为空" });
      continue;
    }
    if (!name) {
      errors.push({ row: rowNumber, message: "合同名称不能为空" });
      continue;
    }
    if (!customerName) {
      errors.push({ row: rowNumber, message: "客户名称不能为空" });
      continue;
    }
    if (amount === null || amount < 0) {
      errors.push({ row: rowNumber, message: "合同金额无效" });
      continue;
    }
    if (!signDate) {
      errors.push({ row: rowNumber, message: "签署日期格式无效" });
      continue;
    }
    if (!contractTypeRaw) {
      errors.push({ row: rowNumber, message: "合同类型不能为空" });
      continue;
    }

    const contractTypeCode = resolveDictionaryCodeByText(
      args.contractTypeCodeByLookup,
      contractTypeRaw,
    );

    validRows.push({
      row: rowNumber,
      customerName,
      contractTypeText: contractTypeRaw,
      contractData: {
        contractNo,
        name,
        signingEntity,
        contractType: contractTypeCode,
        amountWithTax: amount,
        amountWithoutTax: amount,
        taxRate: 0,
        signDate,
        endDate: endDate || undefined,
        attachmentUrl: "",
      },
    });
  }

  return { validRows, errors };
}

export async function prepareContractImportRowsByDeps(args: {
  fileBuffer: Buffer;
  fileName?: string;
  findContractTypes: () => Promise<
    Array<{ code: string; name?: string | null; value?: string | null }>
  >;
  normalizeContractNo: (value: string) => string;
  defaultSigningEntity?: string;
}): Promise<PreparedImportResult> {
  const rows = parseContractImportRows(args.fileBuffer, args.fileName);
  if (rows.length < 2) {
    throw new BadRequestException("导入内容为空或缺少数据行");
  }

  const headers = rows[0];
  const {
    contractNoIdx,
    nameIdx,
    customerNameIdx,
    signingEntityIdx,
    contractTypeIdx,
    amountIdx,
    signDateIdx,
    endDateIdx,
  } = resolveContractImportHeaderIndexes(headers);

  const missingHeaders = collectMissingContractImportHeaders({
    contractNoIdx,
    nameIdx,
    customerNameIdx,
    signingEntityIdx,
    contractTypeIdx,
    amountIdx,
    signDateIdx,
    endDateIdx,
  });
  if (missingHeaders.length > 0) {
    throw new BadRequestException(
      `导入文件缺少必要字段: ${missingHeaders.join("、")}`,
    );
  }

  const contractTypes = await args.findContractTypes();
  const contractTypeCodeByLookup = new Map<string, string>();
  contractTypes.forEach((type) => {
    registerDictionaryLookup(contractTypeCodeByLookup, type);
  });

  const { validRows, errors } = buildPreparedImportRows({
    rows,
    headerIndexes: {
      contractNoIdx,
      nameIdx,
      customerNameIdx,
      signingEntityIdx,
      contractTypeIdx,
      amountIdx,
      signDateIdx,
      endDateIdx,
    },
    contractTypeCodeByLookup,
    normalizeContractNo: args.normalizeContractNo,
    defaultSigningEntity: args.defaultSigningEntity || "InfFinanceMs",
  });

  return {
    total: rows.length - 1,
    validRows,
    errors,
    contractTypeCodeByLookup,
  };
}

export function buildImportPreviewSamples(
  validRows: PreparedImportRow[],
  limit = 5,
): ImportPreviewResult["samples"] {
  return validRows.slice(0, limit).map((row) => ({
    row: row.row,
    contractNo: row.contractData.contractNo,
    name: row.contractData.name,
    customerName: row.customerName,
    contractType: row.contractTypeText,
    amount: Number(row.contractData.amountWithTax),
    signDate: row.contractData.signDate,
  }));
}
