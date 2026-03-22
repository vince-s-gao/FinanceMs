// InfFinanceMs - 角色装饰器

import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

// 角色类型
export type RoleType = "EMPLOYEE" | "SALES" | "FINANCE" | "MANAGER" | "ADMIN";

// 角色常量对象
export const Role = {
  EMPLOYEE: "EMPLOYEE" as RoleType,
  SALES: "SALES" as RoleType,
  FINANCE: "FINANCE" as RoleType,
  MANAGER: "MANAGER" as RoleType,
  ADMIN: "ADMIN" as RoleType,
};

/**
 * 角色装饰器
 * 用于标记接口需要的角色权限
 * @param roles 允许访问的角色列表
 */
export const Roles = (...roles: RoleType[]) => SetMetadata(ROLES_KEY, roles);
