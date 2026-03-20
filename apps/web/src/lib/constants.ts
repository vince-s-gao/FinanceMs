// InfFinanceMs - 前端常量和工具函数

import {
  CONTRACT_STATUS_LABELS as SHARED_CONTRACT_STATUS_LABELS,
  COST_SOURCE_LABELS as SHARED_COST_SOURCE_LABELS,
  CUSTOMER_TYPE_LABELS as SHARED_CUSTOMER_TYPE_LABELS,
  EXPENSE_STATUS_LABELS as SHARED_EXPENSE_STATUS_LABELS,
  EXPENSE_TYPE_LABELS as SHARED_EXPENSE_TYPE_LABELS,
  FEE_TYPE_LABELS as SHARED_FEE_TYPE_LABELS,
  INVOICE_STATUS_LABELS as SHARED_INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS as SHARED_INVOICE_TYPE_LABELS,
  ROLE_LABELS as SHARED_ROLE_LABELS,
} from '@inffinancems/shared';

// 角色标签
export const ROLE_LABELS: Record<string, string> = {
  ...SHARED_ROLE_LABELS,
  SALES: '销售',
};

// 角色颜色
export const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE: 'default',
  SALES: 'green',
  FINANCE: 'blue',
  MANAGER: 'purple',
  ADMIN: 'red',
};

// 客户类型标签
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  ...SHARED_CUSTOMER_TYPE_LABELS,
};

// 客户审批状态标签
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

// 客户审批状态颜色
export const APPROVAL_STATUS_COLORS: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
};

// 合同状态标签
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  ...SHARED_CONTRACT_STATUS_LABELS,
};

// 合同状态颜色
export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  EXECUTING: 'processing',
  COMPLETED: 'success',
  TERMINATED: 'error',
};

// 报销状态标签
export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  ...SHARED_EXPENSE_STATUS_LABELS,
};

// 报销状态颜色
export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'default',
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  PAID: 'cyan',
};

// 报销类型标签
export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  ...SHARED_EXPENSE_TYPE_LABELS,
};

// 发票类型标签
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  ...SHARED_INVOICE_TYPE_LABELS,
};

// 发票状态标签
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  ...SHARED_INVOICE_STATUS_LABELS,
};

// 发票状态颜色
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  ISSUED: 'success',
  VOIDED: 'error',
};

// 发票方向标签
export const INVOICE_DIRECTION_LABELS: Record<string, string> = {
  INBOUND: '进项发票',
  OUTBOUND: '出项发票',
};

// 发票方向颜色
export const INVOICE_DIRECTION_COLORS: Record<string, string> = {
  INBOUND: 'cyan',
  OUTBOUND: 'blue',
};

// 费用类型标签
export const FEE_TYPE_LABELS: Record<string, string> = {
  ...SHARED_FEE_TYPE_LABELS,
};

// 费用来源标签
export const COST_SOURCE_LABELS: Record<string, string> = {
  ...SHARED_COST_SOURCE_LABELS,
};

// 格式化金额（千分位显示）
export function formatAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0.00';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0.00';
  // 使用千分位格式化，保留2位小数
  return num.toLocaleString('zh-CN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2,
    useGrouping: true // 启用千分位分隔符
  });
}

// 格式化金额（带货币符号）
export function formatCurrency(amount: number | string | null | undefined): string {
  return `¥${formatAmount(amount)}`;
}

// 格式化日期
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('zh-CN');
}

// 格式化日期时间
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('zh-CN');
}
