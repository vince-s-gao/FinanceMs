// InfFinanceMs - 认证用户类型

export interface AuthenticatedUser {
  id: string;
  sessionId?: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  departmentId?: string | null;
  avatar?: string | null;
  feishuUserId?: string | null;
  isActive?: boolean;
}
