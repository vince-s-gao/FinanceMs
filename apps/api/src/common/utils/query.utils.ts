// InfFinanceMs - 查询工具函数

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

type PaginationInput = {
  page?: number | string | null;
  pageSize?: number | string | null;
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
};

function toFiniteNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/**
 * 统一规范分页参数，避免超大分页导致性能风险
 */
export function normalizePagination(input: PaginationInput): {
  page: number;
  pageSize: number;
  skip: number;
} {
  const defaultPage = input.defaultPage ?? DEFAULT_PAGE;
  const defaultPageSize = input.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = input.maxPageSize ?? MAX_PAGE_SIZE;

  const parsedPage = Math.floor(toFiniteNumber(input.page));
  const parsedPageSize = Math.floor(toFiniteNumber(input.pageSize));

  const safePage = parsedPage > 0 ? parsedPage : defaultPage;
  const safePageSize = Math.min(
    Math.max(parsedPageSize > 0 ? parsedPageSize : defaultPageSize, 1),
    maxPageSize,
  );

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
  };
}

/**
 * 解析日期区间开始时间
 * 对 YYYY-MM-DD 按本地时区当日 00:00:00.000 处理
 */
export function parseDateRangeStart(input: string): Date {
  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  return new Date(input);
}

/**
 * 解析日期区间结束时间
 * 对 YYYY-MM-DD 按本地时区当日 23:59:59.999 处理
 */
export function parseDateRangeEnd(input: string): Date {
  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split("-").map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  return new Date(input);
}

/**
 * 解析排序字段，非法值回退到默认字段
 */
export function resolveSortField(
  sortBy: string | undefined,
  allowedFields: readonly string[],
  fallbackField: string,
): string {
  if (!sortBy) return fallbackField;
  return allowedFields.includes(sortBy) ? sortBy : fallbackField;
}
