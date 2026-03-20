// InfFinanceMs - 权限服务

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// 默认菜单权限配置
const DEFAULT_MENU_PERMISSIONS: Record<string, string[]> = {
  EMPLOYEE: ['/dashboard', '/expenses'],
  SALES: ['/dashboard', '/customers', '/contracts', '/payments', '/expenses'],
  FINANCE: ['/dashboard', '/customers', '/suppliers', '/contracts', '/payments', '/invoices/inbound', '/invoices/outbound', '/expenses', '/costs', '/budgets', '/reports'],
  MANAGER: ['/dashboard', '/customers', '/suppliers', '/contracts', '/payments', '/invoices/inbound', '/invoices/outbound', '/expenses', '/costs', '/budgets', '/reports'],
  ADMIN: ['/dashboard', '/customers', '/suppliers', '/contracts', '/payments', '/invoices/inbound', '/invoices/outbound', '/expenses', '/costs', '/budgets', '/reports', '/departments', '/permissions', '/settings', '/settings/dictionaries', '/audit-logs'],
};

// 默认功能权限配置
const DEFAULT_FUNCTION_PERMISSIONS: Record<string, string[]> = {
  EMPLOYEE: ['expense.create'],
  SALES: ['expense.create', 'customer.create', 'customer.edit', 'contract.create', 'contract.edit'],
  FINANCE: ['expense.create', 'expense.approve', 'expense.pay', 'invoice.create', 'invoice.void', 'budget.create', 'budget.edit', 'supplier.create', 'supplier.edit', 'supplier.delete'],
  MANAGER: ['expense.create', 'expense.approve', 'customer.create', 'customer.edit', 'customer.approve', 'contract.create', 'contract.edit', 'supplier.create', 'supplier.edit'],
  ADMIN: [
    'expense.create',
    'expense.approve',
    'expense.pay',
    'contract.create',
    'contract.edit',
    'contract.delete',
    'customer.create',
    'customer.edit',
    'customer.delete',
    'customer.approve',
    'supplier.create',
    'supplier.edit',
    'supplier.delete',
    'invoice.create',
    'invoice.void',
    'budget.create',
    'budget.edit',
    'user.create',
    'user.edit',
    'department.manage',
    'dictionary.read',
    'dictionary.create',
    'dictionary.edit',
    'dictionary.delete',
  ],
};

// 所有菜单定义
const ALL_MENUS = [
  { key: '/dashboard', name: '工作台' },
  { key: '/customers', name: '客户管理' },
  { key: '/suppliers', name: '供应商管理' },
  { key: '/contracts', name: '合同管理' },
  { key: '/payments', name: '回款管理' },
  { key: '/invoices/inbound', name: '进项发票管理' },
  { key: '/invoices/outbound', name: '出项发票管理' },
  { key: '/expenses', name: '报销管理' },
  { key: '/costs', name: '费用管理' },
  { key: '/budgets', name: '预算管理' },
  { key: '/reports', name: '报表看板' },
  { key: '/departments', name: '部门管理' },
  { key: '/permissions', name: '权限管理' },
  { key: '/settings', name: '系统设置' },
  { key: '/settings/dictionaries', name: '数据字典' },
  { key: '/audit-logs', name: '日志管理' },
];

// 所有功能定义
const ALL_FUNCTIONS = [
  { key: 'expense.create', name: '创建报销', module: '报销管理' },
  { key: 'expense.approve', name: '审批报销', module: '报销管理' },
  { key: 'expense.pay', name: '报销打款', module: '报销管理' },
  { key: 'contract.create', name: '创建合同', module: '合同管理' },
  { key: 'contract.edit', name: '编辑合同', module: '合同管理' },
  { key: 'contract.delete', name: '删除合同', module: '合同管理' },
  { key: 'customer.create', name: '创建客户', module: '客户管理' },
  { key: 'customer.edit', name: '编辑客户', module: '客户管理' },
  { key: 'customer.delete', name: '删除客户', module: '客户管理' },
  { key: 'customer.approve', name: '审批客户', module: '客户管理' },
  { key: 'supplier.create', name: '创建供应商', module: '供应商管理' },
  { key: 'supplier.edit', name: '编辑供应商', module: '供应商管理' },
  { key: 'supplier.delete', name: '删除供应商', module: '供应商管理' },
  { key: 'invoice.create', name: '开具发票', module: '发票管理' },
  { key: 'invoice.void', name: '作废发票', module: '发票管理' },
  { key: 'budget.create', name: '创建预算', module: '预算管理' },
  { key: 'budget.edit', name: '编辑预算', module: '预算管理' },
  { key: 'user.create', name: '创建用户', module: '系统设置' },
  { key: 'user.edit', name: '编辑用户', module: '系统设置' },
  { key: 'department.manage', name: '管理部门', module: '部门管理' },
  { key: 'dictionary.read', name: '查看字典项', module: '数据字典' },
  { key: 'dictionary.create', name: '新增字典项', module: '数据字典' },
  { key: 'dictionary.edit', name: '编辑字典项', module: '数据字典' },
  { key: 'dictionary.delete', name: '删除字典项', module: '数据字典' },
];

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有菜单定义
   */
  getAllMenus() {
    return ALL_MENUS;
  }

  /**
   * 获取所有功能定义
   */
  getAllFunctions() {
    return ALL_FUNCTIONS;
  }

  /**
   * 获取角色的权限配置
   */
  async getRolePermissions(role: string) {
    // 从数据库获取自定义配置
    const dbPermissions = await this.prisma.rolePermission.findMany({
      where: { role: role as any },
    });

    // 如果数据库没有配置，返回默认配置
    if (dbPermissions.length === 0) {
      return {
        role,
        menus: DEFAULT_MENU_PERMISSIONS[role] || [],
        functions: DEFAULT_FUNCTION_PERMISSIONS[role] || [],
      };
    }

    // 从数据库配置构建权限
    const menus = dbPermissions
      .filter((p) => p.permType === 'menu' && p.isEnabled)
      .map((p) => p.permKey);
    const functions = dbPermissions
      .filter((p) => p.permType === 'function' && p.isEnabled)
      .map((p) => p.permKey);

    return { role, menus, functions };
  }

  /**
   * 获取所有角色的权限配置
   */
  async getAllRolePermissions() {
    const roles = ['EMPLOYEE', 'SALES', 'FINANCE', 'MANAGER', 'ADMIN'];
    const result: Record<string, { menus: string[]; functions: string[] }> = {};

    for (const role of roles) {
      const perms = await this.getRolePermissions(role);
      result[role] = { menus: perms.menus, functions: perms.functions };
    }

    return result;
  }

  /**
   * 更新角色的菜单权限
   */
  async updateRoleMenuPermissions(role: string, menuKeys: string[]) {
    // 删除该角色的所有菜单权限
    await this.prisma.rolePermission.deleteMany({
      where: { role: role as any, permType: 'menu' },
    });

    // 创建新的菜单权限
    if (menuKeys.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: menuKeys.map((key) => ({
          role: role as any,
          permType: 'menu',
          permKey: key,
          isEnabled: true,
        })),
      });
    }

    return this.getRolePermissions(role);
  }

  /**
   * 更新角色的功能权限
   */
  async updateRoleFunctionPermissions(role: string, functionKeys: string[]) {
    // 删除该角色的所有功能权限
    await this.prisma.rolePermission.deleteMany({
      where: { role: role as any, permType: 'function' },
    });

    // 创建新的功能权限
    if (functionKeys.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: functionKeys.map((key) => ({
          role: role as any,
          permType: 'function',
          permKey: key,
          isEnabled: true,
        })),
      });
    }

    return this.getRolePermissions(role);
  }

  /**
   * 批量更新角色权限
   */
  async updateRolePermissions(role: string, menus: string[], functions: string[]) {
    await this.prisma.$transaction([
      // 删除该角色的所有权限
      this.prisma.rolePermission.deleteMany({
        where: { role: role as any },
      }),
      // 创建菜单权限
      this.prisma.rolePermission.createMany({
        data: [
          ...menus.map((key) => ({
            role: role as any,
            permType: 'menu',
            permKey: key,
            isEnabled: true,
          })),
          ...functions.map((key) => ({
            role: role as any,
            permType: 'function',
            permKey: key,
            isEnabled: true,
          })),
        ],
      }),
    ]);

    return this.getRolePermissions(role);
  }

  /**
   * 重置角色权限为默认值
   */
  async resetRolePermissions(role: string) {
    await this.prisma.rolePermission.deleteMany({
      where: { role: role as any },
    });

    return {
      role,
      menus: DEFAULT_MENU_PERMISSIONS[role] || [],
      functions: DEFAULT_FUNCTION_PERMISSIONS[role] || [],
    };
  }

  /**
   * 初始化所有角色的默认权限到数据库
   */
  async initializeDefaultPermissions() {
    const roles = ['EMPLOYEE', 'SALES', 'FINANCE', 'MANAGER', 'ADMIN'];

    for (const role of roles) {
      const existing = await this.prisma.rolePermission.findFirst({
        where: { role: role as any },
      });

      if (!existing) {
        const menus = DEFAULT_MENU_PERMISSIONS[role as keyof typeof DEFAULT_MENU_PERMISSIONS];
        const functions = DEFAULT_FUNCTION_PERMISSIONS[role as keyof typeof DEFAULT_FUNCTION_PERMISSIONS];

        await this.prisma.rolePermission.createMany({
          data: [
            ...menus.map((key) => ({
              role: role as any,
              permType: 'menu',
              permKey: key,
              isEnabled: true,
            })),
            ...functions.map((key) => ({
              role: role as any,
              permType: 'function',
              permKey: key,
              isEnabled: true,
            })),
          ],
        });
      }
    }

    return { message: '初始化完成' };
  }
}
