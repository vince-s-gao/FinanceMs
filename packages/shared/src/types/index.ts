// InfFinanceMs - 共享类型定义

// ==================== API响应类型 ====================

/** 统一API响应格式 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: number;
    message: string;
    details?: unknown;
  };
}

/** 分页请求参数 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** 分页响应数据 */
export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== 用户相关类型 ====================

/** 用户角色 */
export type UserRole = 'EMPLOYEE' | 'FINANCE' | 'MANAGER' | 'ADMIN';

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  user: AuthUser;
}

/** 当前用户信息 */
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  avatar?: string;
}

/** 认证用户信息（前后端共享） */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole | 'SALES';
  departmentId?: string | null;
  avatar?: string | null;
}

// ==================== 客户相关类型 ====================

/** 客户类型 */
export type CustomerType = 'ENTERPRISE' | 'INDIVIDUAL';

/** 创建客户请求 */
export interface CreateCustomerRequest {
  name: string;
  type: CustomerType;
  creditCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  remark?: string;
}

/** 更新客户请求 */
export interface UpdateCustomerRequest extends Partial<CreateCustomerRequest> {}

// ==================== 合同相关类型 ====================

/** 合同状态 */
export type ContractStatus = 'DRAFT' | 'EXECUTING' | 'COMPLETED' | 'TERMINATED';

/** 创建合同请求 */
export interface CreateContractRequest {
  contractNo: string;
  name: string;
  customerId: string;
  signingEntity?: string;
  contractType?: string;
  amountWithTax: number;
  amountWithoutTax: number;
  taxRate?: number;
  attachmentUrl?: string;
  attachmentName?: string;
  signDate: string;
  startDate?: string;
  endDate?: string;
  remark?: string;
}

/** 更新合同请求 */
export interface UpdateContractRequest extends Partial<CreateContractRequest> {}

/** 合同状态变更请求 */
export interface ChangeContractStatusRequest {
  status: ContractStatus;
  reason?: string;
}

// ==================== 回款相关类型 ====================

/** 回款计划状态 */
export type PaymentPlanStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

/** 回款方式 */
export type PaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK';

/** 创建回款计划请求 */
export interface CreatePaymentPlanRequest {
  contractId: string;
  period: number;
  planAmount: number;
  planDate: string;
}

/** 创建回款记录请求 */
export interface CreatePaymentRecordRequest {
  contractId: string;
  planId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: PaymentMethod;
  remark?: string;
}

// ==================== 发票相关类型 ====================

/** 发票类型 */
export type InvoiceType = 'VAT_SPECIAL' | 'VAT_NORMAL' | 'RECEIPT';

/** 发票状态 */
export type InvoiceStatus = 'ISSUED' | 'VOIDED';

/** 发票方向 */
export type InvoiceDirection = 'INBOUND' | 'OUTBOUND';

/** 创建发票请求 */
export interface CreateInvoiceRequest {
  contractId: string;
  invoiceNo: string;
  invoiceType: InvoiceType;
  amount: number;
  taxAmount?: number;
  invoiceDate: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

// ==================== 报销相关类型 ====================

/** 报销类型 */
export type ExpenseType = 'TRAVEL' | 'DAILY' | 'PROJECT';

/** 报销状态 */
export type ExpenseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

/** 费用类型 */
export type FeeType = 'TRAVEL' | 'TRANSPORT' | 'ACCOMMODATION' | 'MEAL' | 'OFFICE' | 'COMMUNICATION' | 'OTHER';

/** 报销明细 */
export interface ExpenseDetailInput {
  feeType: FeeType;
  occurDate: string;
  amount: number;
  hasInvoice: boolean;
  invoiceType?: string;
  invoiceNo?: string;
  description?: string;
}

/** 创建报销请求 */
export interface CreateExpenseRequest {
  expenseType: ExpenseType;
  contractId?: string;
  details: ExpenseDetailInput[];
}

/** 审批报销请求 */
export interface ApproveExpenseRequest {
  approved: boolean;
  rejectReason?: string;
}

// ==================== 费用相关类型 ====================

/** 费用来源 */
export type CostSource = 'DIRECT' | 'REIMBURSEMENT';

/** 创建费用请求 */
export interface CreateCostRequest {
  feeType: FeeType;
  amount: number;
  occurDate: string;
  projectId: string;
  contractId?: string;
  description?: string;
}

/** 费用列表项 */
export interface CostItem {
  id: string;
  feeType: string;
  amount: number;
  occurDate: string;
  source: 'DIRECT' | 'REIMBURSEMENT';
  description?: string;
  project?: {
    id: string;
    code: string;
    name: string;
  } | null;
  contract?: {
    id: string;
    contractNo: string;
    name: string;
  } | null;
  expense?: {
    id: string;
    expenseNo: string;
  } | null;
}

/** 简化合同选项 */
export interface ContractOption {
  id: string;
  contractNo: string;
  name: string;
}

/** 简化项目选项 */
export interface ProjectOption {
  id: string;
  code: string;
  name: string;
}

/** 统一错误结构 */
export interface StandardErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

// ==================== 消息通知 ====================

export type NotificationType = 'SYSTEM' | 'APPROVAL' | 'PAYMENT' | 'ALERT';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  link?: string | null;
  metadata?: unknown;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

// ==================== 日志管理 ====================

export type AuditAction = 'LOGIN' | 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogItem {
  id: string;
  userId: string;
  action: AuditAction | string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

// ==================== 报表相关类型 ====================

/** 应收账款总览 */
export interface ReceivablesOverview {
  totalContractAmount: number;
  totalReceived: number;
  totalReceivable: number;
  agingDistribution: {
    normal: number;
    days0to30: number;
    days31to90: number;
    daysOver90: number;
  };
}

/** 客户维度报表 */
export interface CustomerReport {
  customerId: string;
  customerName: string;
  contractCount: number;
  totalAmount: number;
  receivedAmount: number;
  receivableAmount: number;
  overdueOver90: number;
}

/** 报销分析 */
export interface ExpenseAnalysis {
  monthlyTotal: number;
  pendingCount: number;
  pendingAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  noInvoiceRatio: number;
}
