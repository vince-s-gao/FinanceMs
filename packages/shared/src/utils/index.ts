// InfFinanceMs - 共享工具函数

import { CODE_PREFIX } from '../constants';

// ==================== 编号生成 ====================

/**
 * 生成客户编号
 * 格式: CUS + 6位流水号
 * @param sequence 流水号
 */
export function generateCustomerCode(sequence: number): string {
  return `${CODE_PREFIX.CUSTOMER}${String(sequence).padStart(6, '0')}`;
}

/**
 * 生成合同编号
 * 格式: HT + 年月 + 4位流水号
 * @param date 日期
 * @param sequence 流水号
 */
export function generateContractNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${CODE_PREFIX.CONTRACT}${year}${month}-${String(sequence).padStart(4, '0')}`;
}

/**
 * 生成报销单号
 * 格式: BX + 年月 + 4位流水号
 * @param date 日期
 * @param sequence 流水号
 */
export function generateExpenseNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${CODE_PREFIX.EXPENSE}${year}${month}-${String(sequence).padStart(4, '0')}`;
}

// ==================== 金额处理 ====================

/**
 * 格式化金额（千分位）
 * @param amount 金额
 * @param decimals 小数位数，默认2位
 */
export function formatAmount(amount: number | string, decimals = 2): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 格式化金额（带货币符号）
 * @param amount 金额
 */
export function formatCurrency(amount: number | string): string {
  return `¥${formatAmount(amount)}`;
}

/**
 * 解析金额字符串为数字
 * @param amountStr 金额字符串
 */
export function parseAmount(amountStr: string): number {
  const cleaned = amountStr.replace(/[,￥¥\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ==================== 日期处理 ====================

/**
 * 格式化日期
 * @param date 日期
 * @param format 格式，默认 YYYY-MM-DD
 */
export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 计算两个日期之间的天数差
 * @param date1 日期1
 * @param date2 日期2
 */
export function daysBetween(date1: Date | string, date2: Date | string): number {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 计算账龄（天数）
 * @param dueDate 到期日期
 */
export function calculateAging(dueDate: Date | string): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  if (due >= today) return 0; // 未逾期
  return daysBetween(due, today);
}

/**
 * 获取账龄分段
 * @param agingDays 账龄天数
 */
export function getAgingBucket(agingDays: number): 'normal' | '0-30' | '31-90' | '90+' {
  if (agingDays <= 0) return 'normal';
  if (agingDays <= 30) return '0-30';
  if (agingDays <= 90) return '31-90';
  return '90+';
}

// ==================== 验证函数 ====================

/**
 * 验证手机号
 * @param phone 手机号
 */
export function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证邮箱
 * @param email 邮箱
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * 验证统一社会信用代码
 * @param code 信用代码
 */
export function isValidCreditCode(code: string): boolean {
  return /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/.test(code);
}

// ==================== 其他工具 ====================

/**
 * 计算百分比
 * @param value 值
 * @param total 总数
 * @param decimals 小数位数
 */
export function calculatePercentage(value: number, total: number, decimals = 2): number {
  if (total === 0) return 0;
  return Number(((value / total) * 100).toFixed(decimals));
}

/**
 * 安全的JSON解析
 * @param str JSON字符串
 * @param defaultValue 默认值
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 延迟函数
 * @param ms 毫秒数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 生成随机ID
 * @param length 长度
 */
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
