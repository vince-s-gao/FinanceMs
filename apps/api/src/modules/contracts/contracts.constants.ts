import { normalizeText } from "../../common/utils/tabular.utils";

// 合同状态常量
export const ContractStatus = {
  DRAFT: "DRAFT",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  TERMINATED: "TERMINATED",
} as const;

export const ALLOWED_CONTRACT_SORT_FIELDS = [
  "contractNo",
  "name",
  "signingEntity",
  "contractType",
  "amountWithTax",
  "signDate",
  "endDate",
  "status",
  "createdAt",
  "updatedAt",
] as const;

export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "草稿",
  EXECUTING: "执行中",
  COMPLETED: "已完成",
  TERMINATED: "已终止",
};

export const IMPORT_HEADER_ALIASES = {
  contractNo: ["合同编号", "contract_no", "contractno", "no"],
  name: ["合同名称", "name", "contract_name", "contractname"],
  customerName: ["客户名称", "customer_name", "customername", "customer"],
  signingEntity: [
    "公司签约主体",
    "签约主体",
    "signing_entity",
    "signingentity",
    "company",
  ],
  contractType: ["合同类型", "contract_type", "contracttype", "type"],
  amount: ["合同金额", "金额", "contract_amount", "contractamount", "amount"],
  signDate: ["签署日期", "签订日期", "sign_date", "signdate"],
  endDate: ["结束日期", "到期日期", "end_date", "enddate"],
} as const;

export const IMPORT_CUSTOMER_REMARK_VISIBLE =
  "由合同导入自动创建，待完善客户信息";
export const IMPORT_CUSTOMER_REMARK_HIDDEN_NON_SALES =
  "由非销售合同自动创建（隐藏），仅用于合同关联";

export function formatDateOnly(value?: Date | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function toDateString(value: string): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const normalizeValidDate = (date: Date): string | null => {
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    if (year < 1900 || year > 2100) return null;
    return date.toISOString().slice(0, 10);
  };

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.M.D
  const ymdMatched = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatched) {
    const year = Number(ymdMatched[1]);
    const month = Number(ymdMatched[2]);
    const day = Number(ymdMatched[3]);
    const normalized = normalizeValidDate(
      new Date(Date.UTC(year, month - 1, day)),
    );
    if (!normalized) return null;
    const [ny, nm, nd] = normalized.split("-").map((n) => Number(n));
    if (ny !== year || nm !== month || nd !== day) return null;
    return normalized;
  }

  // YYYYMMDD
  const compactMatched = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatched) {
    const year = Number(compactMatched[1]);
    const month = Number(compactMatched[2]);
    const day = Number(compactMatched[3]);
    const normalized = normalizeValidDate(
      new Date(Date.UTC(year, month - 1, day)),
    );
    if (!normalized) return null;
    const [ny, nm, nd] = normalized.split("-").map((n) => Number(n));
    if (ny !== year || nm !== month || nd !== day) return null;
    return normalized;
  }

  // Excel serial date, e.g. 46025 -> 2026-01-03
  const asNumber = Number(text);
  if (
    !Number.isNaN(asNumber) &&
    Number.isFinite(asNumber) &&
    asNumber > 0 &&
    asNumber < 100000
  ) {
    const serial = Math.floor(asNumber);
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpochUtc + serial * 24 * 60 * 60 * 1000);
    const normalized = normalizeValidDate(date);
    if (normalized) return normalized;
  }

  return normalizeValidDate(new Date(text));
}

export function toNumber(value: string): number | null {
  const raw = normalizeText(value).replace(/[¥￥,\s]/g, "");
  if (!raw) return null;
  const result = Number(raw);
  if (Number.isNaN(result)) return null;
  return result;
}
