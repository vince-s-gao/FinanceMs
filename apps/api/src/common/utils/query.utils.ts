// InfFinanceMs - 查询工具函数

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 解析日期区间开始时间
 * 对 YYYY-MM-DD 按本地时区当日 00:00:00.000 处理
 */
export function parseDateRangeStart(input: string): Date {
  if (DATE_ONLY_REGEX.test(input)) {
    const [year, month, day] = input.split('-').map(Number);
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
    const [year, month, day] = input.split('-').map(Number);
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
