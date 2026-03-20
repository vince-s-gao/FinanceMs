// InfFinanceMs - 共享常量定义

// ==================== 角色相关 ====================

/** 角色名称映射 */
export const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: '员工',
  FINANCE: '财务',
  MANAGER: '管理层',
  ADMIN: '管理员',
};

/** 角色颜色映射 */
export const ROLE_COLORS: Record<string, string> = {
  EMPLOYEE: '#8c8c8c',
  FINANCE: '#1890ff',
  MANAGER: '#722ed1',
  ADMIN: '#f5222d',
};

// ==================== 客户相关 ====================

/** 客户类型名称映射 */
export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  ENTERPRISE: '企业',
  INDIVIDUAL: '个人',
};

// ==================== 合同相关 ====================

/** 合同状态名称映射 */
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  EXECUTING: '执行中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
};

/** 合同状态颜色映射 */
export const CONTRACT_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#8c8c8c',
  EXECUTING: '#1890ff',
  COMPLETED: '#52c41a',
  TERMINATED: '#ff4d4f',
};

// ==================== 回款相关 ====================

/** 回款计划状态名称映射 */
export const PAYMENT_PLAN_STATUS_LABELS: Record<string, string> = {
  PENDING: '待回款',
  PARTIAL: '部分回款',
  COMPLETED: '已完成',
};

/** 回款计划状态颜色映射 */
export const PAYMENT_PLAN_STATUS_COLORS: Record<string, string> = {
  PENDING: '#8c8c8c',
  PARTIAL: '#faad14',
  COMPLETED: '#52c41a',
};

/** 回款方式名称映射 */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  TRANSFER: '转账',
  CASH: '现金',
  CHECK: '支票',
};

// ==================== 发票相关 ====================

/** 发票类型名称映射 */
export const INVOICE_TYPE_LABELS: Record<string, string> = {
  VAT_SPECIAL: '增值税专用发票',
  VAT_NORMAL: '增值税普通发票',
  RECEIPT: '收据',
};

/** 发票状态名称映射 */
export const INVOICE_STATUS_LABELS: Record<string, string> = {
  ISSUED: '已开具',
  VOIDED: '已作废',
};

/** 发票状态颜色映射 */
export const INVOICE_STATUS_COLORS: Record<string, string> = {
  ISSUED: '#52c41a',
  VOIDED: '#ff4d4f',
};

/** 发票方向名称映射 */
export const INVOICE_DIRECTION_LABELS: Record<string, string> = {
  INBOUND: '进项发票',
  OUTBOUND: '出项发票',
};

/** 发票方向颜色映射 */
export const INVOICE_DIRECTION_COLORS: Record<string, string> = {
  INBOUND: '#13c2c2',
  OUTBOUND: '#2f54eb',
};

// ==================== 报销相关 ====================

/** 报销类型名称映射 */
export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  TRAVEL: '差旅',
  DAILY: '日常',
  PROJECT: '项目',
};

/** 报销状态名称映射 */
export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '审批中',
  APPROVED: '已批准',
  REJECTED: '已驳回',
  PAID: '已打款',
};

/** 报销状态颜色映射 */
export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#8c8c8c',
  PENDING: '#1890ff',
  APPROVED: '#52c41a',
  REJECTED: '#ff4d4f',
  PAID: '#52c41a',
};

// ==================== 费用相关 ====================

/** 费用类型名称映射 */
export const FEE_TYPE_LABELS: Record<string, string> = {
  TRAVEL: '差旅费',
  TRANSPORT: '交通费',
  ACCOMMODATION: '住宿费',
  MEAL: '餐饮费',
  OFFICE: '办公费',
  COMMUNICATION: '通讯费',
  OTHER: '其他',
};

/** 费用类型枚举 */
export const FEE_TYPES = [
  'TRAVEL',
  'TRANSPORT',
  'ACCOMMODATION',
  'MEAL',
  'OFFICE',
  'COMMUNICATION',
  'OTHER',
] as const;

/** 费用来源名称映射 */
export const COST_SOURCE_LABELS: Record<string, string> = {
  DIRECT: '直接录入',
  REIMBURSEMENT: '报销生成',
};

/** 费用来源常量 */
export const COST_SOURCE = {
  DIRECT: 'DIRECT',
  REIMBURSEMENT: 'REIMBURSEMENT',
} as const;

/** 费用来源枚举 */
export const COST_SOURCES = [COST_SOURCE.DIRECT, COST_SOURCE.REIMBURSEMENT] as const;

// ==================== 分页相关 ====================

/** 默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20;

/** 分页大小选项 */
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ==================== 编号前缀 ====================

/** 编号前缀 */
export const CODE_PREFIX = {
  CUSTOMER: 'CUS',
  CONTRACT: 'HT',
  EXPENSE: 'BX',
};

// ==================== 错误码 ====================

/** 错误码定义 */
export const ERROR_CODES = {
  // 通用错误 10xxx
  VALIDATION_ERROR: 10001,
  UNAUTHORIZED: 10002,
  FORBIDDEN: 10003,
  NOT_FOUND: 10004,
  BUSINESS_ERROR: 10005,
  INTERNAL_ERROR: 10006,

  // 合同错误 20xxx
  CONTRACT_STATUS_INVALID: 20001,
  PAYMENT_EXCEEDS_RECEIVABLE: 20002,
  EXPENSE_ALREADY_APPROVED: 20003,
};

/** 错误消息映射 */
export const ERROR_MESSAGES: Record<number, string> = {
  10001: '参数校验失败',
  10002: '未授权访问',
  10003: '权限不足',
  10004: '资源不存在',
  10005: '业务逻辑错误',
  10006: '服务器内部错误',
  20001: '合同状态不允许此操作',
  20002: '回款金额超出应收',
  20003: '报销单已审批，不可修改',
};

/** 统一字符串错误码（用于前后端对齐） */
export const ERROR_CODE = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_ACCOUNT_DISABLED: 'AUTH_ACCOUNT_DISABLED',
  AUTH_PASSWORD_NOT_SET: 'AUTH_PASSWORD_NOT_SET',
  AUTH_REFRESH_TOKEN_MISSING: 'AUTH_REFRESH_TOKEN_MISSING',
  AUTH_REFRESH_TOKEN_INVALID: 'AUTH_REFRESH_TOKEN_INVALID',
  AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
  CSRF_TOKEN_INVALID: 'CSRF_TOKEN_INVALID',
  COST_NOT_FOUND: 'COST_NOT_FOUND',
  COST_PROJECT_NOT_FOUND: 'COST_PROJECT_NOT_FOUND',
  COST_CONTRACT_NOT_FOUND: 'COST_CONTRACT_NOT_FOUND',
  COST_DELETE_REIMBURSEMENT_FORBIDDEN: 'COST_DELETE_REIMBURSEMENT_FORBIDDEN',
} as const;
