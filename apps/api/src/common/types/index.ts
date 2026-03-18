// InfFinanceMs - 公共类型定义

// 角色类型
export type Role = 'EMPLOYEE' | 'FINANCE' | 'MANAGER' | 'ADMIN';

// 角色常量
export const RoleEnum = {
  EMPLOYEE: 'EMPLOYEE' as Role,
  FINANCE: 'FINANCE' as Role,
  MANAGER: 'MANAGER' as Role,
  ADMIN: 'ADMIN' as Role,
};

// 客户类型
export type CustomerType = 'ENTERPRISE' | 'INDIVIDUAL';

// 合同状态
export type ContractStatus = 'DRAFT' | 'EXECUTING' | 'COMPLETED' | 'TERMINATED';

// 合同状态常量
export const ContractStatusEnum = {
  DRAFT: 'DRAFT' as ContractStatus,
  EXECUTING: 'EXECUTING' as ContractStatus,
  COMPLETED: 'COMPLETED' as ContractStatus,
  TERMINATED: 'TERMINATED' as ContractStatus,
};

// 回款计划状态
export type PaymentPlanStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

// 回款方式
export type PaymentMethod = 'TRANSFER' | 'CASH' | 'CHECK';

// 发票类型
export type InvoiceType = 'VAT_SPECIAL' | 'VAT_NORMAL' | 'RECEIPT';

// 发票状态
export type InvoiceStatus = 'ISSUED' | 'VOIDED';

// 报销类型
export type ExpenseType = 'TRAVEL' | 'DAILY' | 'PROJECT';

// 报销状态
export type ExpenseStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

// 费用类型
export type FeeType = 'TRAVEL' | 'TRANSPORT' | 'ACCOMMODATION' | 'MEAL' | 'OFFICE' | 'COMMUNICATION' | 'OTHER';

// 费用来源
export type CostSource = 'DIRECT' | 'REIMBURSEMENT';
