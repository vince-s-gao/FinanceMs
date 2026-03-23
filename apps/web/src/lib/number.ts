import type { InputNumberProps } from "antd";

const MONEY_FORMAT_OPTIONS = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
} as const;

function sanitizeNumericText(
  value: string,
  includeCurrencySymbol = false,
): string {
  const withoutCurrency = includeCurrencySymbol
    ? value.replace(/[¥￥]/g, "")
    : value;
  return withoutCurrency.replace(/,/g, "").trim();
}

export function formatLocaleMoney(
  value: string | number | null | undefined,
): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "0.00";
  return numeric.toLocaleString("zh-CN", MONEY_FORMAT_OPTIONS);
}

export const formatThousandSeparated: NonNullable<
  InputNumberProps<number>["formatter"]
> = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const parseThousandSeparated: NonNullable<
  InputNumberProps<number>["parser"]
> = (displayValue) => {
  const normalized = sanitizeNumericText(displayValue || "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseCurrencySeparated: NonNullable<
  InputNumberProps<number>["parser"]
> = (displayValue) => {
  const normalized = sanitizeNumericText(displayValue || "", true);
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
