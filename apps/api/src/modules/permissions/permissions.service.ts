// InfFinanceMs - 权限服务

import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Role } from "@prisma/client";

// 默认菜单权限配置
const DEFAULT_MENU_PERMISSIONS: Record<string, string[]> = {
  EMPLOYEE: ["/dashboard", "/expenses"],
  SALES: [
    "/dashboard",
    "/customers",
    "/contracts",
    "/payments",
    "/expenses",
    "/projects",
  ],
  FINANCE: [
    "/dashboard",
    "/customers",
    "/suppliers",
    "/contracts",
    "/payments",
    "/payment-requests",
    "/invoices",
    "/expenses",
    "/costs",
    "/budgets",
    "/reports",
    "/projects",
  ],
  MANAGER: [
    "/dashboard",
    "/customers",
    "/suppliers",
    "/contracts",
    "/payments",
    "/payment-requests",
    "/invoices",
    "/expenses",
    "/costs",
    "/budgets",
    "/reports",
    "/projects",
  ],
  ADMIN: [
    "/dashboard",
    "/customers",
    "/suppliers",
    "/contracts",
    "/payments",
    "/payment-requests",
    "/invoices",
    "/expenses",
    "/costs",
    "/budgets",
    "/reports",
    "/projects",
    "/departments",
    "/permissions",
    "/settings",
    "/settings/dictionaries",
    "/audit-logs",
  ],
};

// 默认功能权限配置
const DEFAULT_FUNCTION_PERMISSIONS: Record<string, string[]> = {
  EMPLOYEE: [
    "expense.view",
    "expense.create",
    "expense.edit",
    "expense.submit",
    "expense.delete",
  ],
  SALES: [
    "expense.create",
    "customer.view",
    "customer.create",
    "customer.edit",
    "contract.view",
    "contract.create",
    "contract.edit",
    "payment.view",
    "project.view",
  ],
  FINANCE: [
    "contract.view",
    "contract.export",
    "budget.view",
    "customer.view",
    "customer.export",
    "supplier.view",
    "supplier.export",
    "invoice.view",
    "expense.view",
    "expense.create",
    "expense.edit",
    "expense.submit",
    "expense.delete",
    "expense.approve",
    "expense.pay",
    "invoice.create",
    "invoice.void",
    "budget.create",
    "budget.edit",
    "budget.freeze",
    "budget.close",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "cost.view",
    "cost.create",
    "cost.edit",
    "cost.delete",
    "payment.view",
    "payment-request.view",
    "payment.plan.create",
    "payment.plan.delete",
    "payment.record.create",
    "payment.record.delete",
    "payment-request.create",
    "payment-request.edit",
    "payment-request.submit",
    "payment-request.confirm",
    "payment-request.cancel",
    "payment-request.delete",
    "bank-account.view",
    "bank-account.create",
    "bank-account.edit",
    "project.view",
    "project.create",
    "project.edit",
    "project.delete",
    "report.view",
    "report.export",
  ],
  MANAGER: [
    "expense.view",
    "expense.approve",
    "contract.view",
    "contract.export",
    "budget.view",
    "customer.view",
    "customer.export",
    "customer.create",
    "customer.edit",
    "customer.approve",
    "contract.create",
    "contract.edit",
    "supplier.view",
    "supplier.export",
    "supplier.create",
    "supplier.edit",
    "invoice.view",
    "cost.view",
    "payment.view",
    "payment-request.view",
    "payment-request.create",
    "payment-request.edit",
    "payment-request.submit",
    "payment-request.approve",
    "payment-request.cancel",
    "bank-account.view",
    "project.view",
    "project.create",
    "project.edit",
    "project.delete",
    "report.view",
    "report.export",
  ],
  ADMIN: [
    "expense.view",
    "expense.create",
    "expense.edit",
    "expense.submit",
    "expense.delete",
    "expense.approve",
    "expense.pay",
    "contract.view",
    "contract.export",
    "contract.create",
    "contract.edit",
    "contract.delete",
    "customer.view",
    "customer.export",
    "customer.create",
    "customer.edit",
    "customer.delete",
    "customer.approve",
    "supplier.view",
    "supplier.export",
    "supplier.create",
    "supplier.edit",
    "supplier.delete",
    "cost.view",
    "cost.create",
    "cost.edit",
    "cost.delete",
    "invoice.view",
    "invoice.create",
    "invoice.void",
    "invoice.delete",
    "budget.view",
    "budget.create",
    "budget.edit",
    "budget.freeze",
    "budget.close",
    "budget.delete",
    "payment.view",
    "payment-request.view",
    "payment.plan.create",
    "payment.plan.delete",
    "payment.record.create",
    "payment.record.delete",
    "payment-request.create",
    "payment-request.edit",
    "payment-request.submit",
    "payment-request.approve",
    "payment-request.confirm",
    "payment-request.cancel",
    "payment-request.delete",
    "bank-account.view",
    "bank-account.create",
    "bank-account.edit",
    "bank-account.delete",
    "project.view",
    "project.create",
    "project.edit",
    "project.delete",
    "report.view",
    "report.export",
    "user.create",
    "user.edit",
    "user.delete",
    "department.manage",
    "dictionary.read",
    "dictionary.create",
    "dictionary.edit",
    "dictionary.delete",
  ],
};

// 所有菜单定义
const ALL_MENUS = [
  { key: "/dashboard", name: "工作台" },
  { key: "/customers", name: "客户管理" },
  { key: "/suppliers", name: "供应商管理" },
  { key: "/contracts", name: "合同管理" },
  { key: "/payments", name: "回款管理" },
  { key: "/payment-requests", name: "付款申请" },
  { key: "/invoices", name: "发票管理" },
  { key: "/expenses", name: "报销管理" },
  { key: "/costs", name: "费用管理" },
  { key: "/budgets", name: "预算管理" },
  { key: "/reports", name: "报表看板" },
  { key: "/projects", name: "项目管理" },
  { key: "/departments", name: "员工管理" },
  { key: "/permissions", name: "权限管理" },
  { key: "/settings", name: "系统设置" },
  { key: "/settings/dictionaries", name: "数据字典" },
  { key: "/audit-logs", name: "日志管理" },
];
const ALL_MENU_KEYS = new Set(ALL_MENUS.map((item) => item.key));

// 所有功能定义
const ALL_FUNCTIONS = [
  { key: "expense.view", name: "查看报销", module: "报销管理" },
  { key: "expense.create", name: "创建报销", module: "报销管理" },
  { key: "expense.edit", name: "编辑报销", module: "报销管理" },
  { key: "expense.submit", name: "提交报销", module: "报销管理" },
  { key: "expense.delete", name: "删除报销", module: "报销管理" },
  { key: "expense.approve", name: "审批报销", module: "报销管理" },
  { key: "expense.pay", name: "报销打款", module: "报销管理" },
  { key: "contract.create", name: "创建合同", module: "合同管理" },
  { key: "contract.edit", name: "编辑合同", module: "合同管理" },
  { key: "contract.delete", name: "删除合同", module: "合同管理" },
  { key: "contract.view", name: "查看合同", module: "合同管理" },
  { key: "contract.export", name: "导出合同", module: "合同管理" },
  { key: "customer.view", name: "查看客户", module: "客户管理" },
  { key: "customer.export", name: "导出客户", module: "客户管理" },
  { key: "customer.create", name: "创建客户", module: "客户管理" },
  { key: "customer.edit", name: "编辑客户", module: "客户管理" },
  { key: "customer.delete", name: "删除客户", module: "客户管理" },
  { key: "customer.approve", name: "审批客户", module: "客户管理" },
  { key: "supplier.view", name: "查看供应商", module: "供应商管理" },
  { key: "supplier.export", name: "导出供应商", module: "供应商管理" },
  { key: "supplier.create", name: "创建供应商", module: "供应商管理" },
  { key: "supplier.edit", name: "编辑供应商", module: "供应商管理" },
  { key: "supplier.delete", name: "删除供应商", module: "供应商管理" },
  { key: "invoice.view", name: "查看发票", module: "发票管理" },
  { key: "cost.view", name: "查看费用", module: "费用管理" },
  { key: "cost.create", name: "创建费用", module: "费用管理" },
  { key: "cost.edit", name: "编辑费用", module: "费用管理" },
  { key: "cost.delete", name: "删除费用", module: "费用管理" },
  { key: "invoice.create", name: "开具发票", module: "发票管理" },
  { key: "invoice.void", name: "作废发票", module: "发票管理" },
  { key: "invoice.delete", name: "删除发票", module: "发票管理" },
  { key: "budget.view", name: "查看预算", module: "预算管理" },
  { key: "budget.create", name: "创建预算", module: "预算管理" },
  { key: "budget.edit", name: "编辑预算", module: "预算管理" },
  { key: "budget.freeze", name: "冻结/解冻预算", module: "预算管理" },
  { key: "budget.close", name: "关闭预算", module: "预算管理" },
  { key: "budget.delete", name: "删除预算", module: "预算管理" },
  { key: "payment.view", name: "查看回款看板", module: "回款管理" },
  { key: "payment.plan.create", name: "创建回款计划", module: "回款管理" },
  { key: "payment.plan.delete", name: "删除回款计划", module: "回款管理" },
  { key: "payment.record.create", name: "创建回款记录", module: "回款管理" },
  { key: "payment.record.delete", name: "删除回款记录", module: "回款管理" },
  {
    key: "payment-request.view",
    name: "查看付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.create",
    name: "创建付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.edit",
    name: "编辑付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.submit",
    name: "提交付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.approve",
    name: "审批付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.confirm",
    name: "确认付款",
    module: "付款申请",
  },
  {
    key: "payment-request.cancel",
    name: "取消付款申请",
    module: "付款申请",
  },
  {
    key: "payment-request.delete",
    name: "删除付款申请",
    module: "付款申请",
  },
  {
    key: "bank-account.view",
    name: "查看收款账户",
    module: "付款申请",
  },
  {
    key: "bank-account.create",
    name: "创建收款账户",
    module: "付款申请",
  },
  {
    key: "bank-account.edit",
    name: "编辑收款账户",
    module: "付款申请",
  },
  {
    key: "bank-account.delete",
    name: "删除收款账户",
    module: "付款申请",
  },
  { key: "project.view", name: "查看项目", module: "项目管理" },
  { key: "project.create", name: "创建项目", module: "项目管理" },
  { key: "project.edit", name: "编辑项目", module: "项目管理" },
  { key: "project.delete", name: "删除项目", module: "项目管理" },
  { key: "report.view", name: "查看报表", module: "报表看板" },
  { key: "report.export", name: "导出报表", module: "报表看板" },
  { key: "user.create", name: "创建用户", module: "系统设置" },
  { key: "user.edit", name: "编辑用户", module: "系统设置" },
  { key: "user.delete", name: "删除用户", module: "系统设置" },
  { key: "department.manage", name: "管理员工组织", module: "员工管理" },
  { key: "dictionary.read", name: "查看字典项", module: "数据字典" },
  { key: "dictionary.create", name: "新增字典项", module: "数据字典" },
  { key: "dictionary.edit", name: "编辑字典项", module: "数据字典" },
  { key: "dictionary.delete", name: "删除字典项", module: "数据字典" },
];
const ALL_FUNCTION_KEYS = new Set(ALL_FUNCTIONS.map((item) => item.key));

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  private toRole(role: string): Role | null {
    if (!role) return null;
    const upper = role.toUpperCase();
    return Object.values(Role).includes(upper as Role) ? (upper as Role) : null;
  }

  private requireValidRole(role: string): Role {
    const normalizedRole = this.toRole(role);
    if (!normalizedRole) {
      throw new BadRequestException("无效的角色标识");
    }
    return normalizedRole;
  }

  private normalizeMenuKeys(menuKeys: string[]): string[] {
    const mapped = menuKeys.map((key) => {
      if (key === "/invoices/inbound" || key === "/invoices/outbound") {
        return "/invoices";
      }
      return key;
    });
    return Array.from(new Set(mapped));
  }

  private assertValidMenuKeys(menuKeys: string[]) {
    const invalidKeys = menuKeys.filter((key) => !ALL_MENU_KEYS.has(key));
    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `存在无效菜单权限: ${invalidKeys.join(", ")}`,
      );
    }
  }

  private assertValidFunctionKeys(functionKeys: string[]) {
    const invalidKeys = functionKeys.filter(
      (key) => !ALL_FUNCTION_KEYS.has(key),
    );
    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `存在无效功能权限: ${invalidKeys.join(", ")}`,
      );
    }
  }

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
    const normalizedRole = this.toRole(role);
    if (!normalizedRole) {
      return {
        role,
        menus: [],
        functions: [],
      };
    }

    // 从数据库获取自定义配置
    const dbPermissions = await this.prisma.rolePermission.findMany({
      where: { role: normalizedRole },
    });

    // 如果数据库没有配置，返回默认配置
    if (dbPermissions.length === 0) {
      return {
        role,
        menus: this.normalizeMenuKeys(DEFAULT_MENU_PERMISSIONS[role] || []),
        functions: DEFAULT_FUNCTION_PERMISSIONS[role] || [],
      };
    }

    // 从数据库配置构建权限
    const menus = this.normalizeMenuKeys(
      dbPermissions
        .filter((p) => p.permType === "menu" && p.isEnabled)
        .map((p) => p.permKey),
    );
    const functions = dbPermissions
      .filter((p) => p.permType === "function" && p.isEnabled)
      .map((p) => p.permKey);

    // 向后兼容：老权限数据可能没有新增的只读权限键
    const functionSet = new Set(functions);
    if (
      !functionSet.has("payment.view") &&
      (menus.includes("/payments") ||
        functions.some((key) => key.startsWith("payment.")))
    ) {
      functionSet.add("payment.view");
    }
    if (
      !functionSet.has("contract.view") &&
      (menus.includes("/contracts") ||
        functions.some((key) => key.startsWith("contract.")))
    ) {
      functionSet.add("contract.view");
    }
    if (
      !functionSet.has("customer.view") &&
      (menus.includes("/customers") ||
        functions.some((key) => key.startsWith("customer.")))
    ) {
      functionSet.add("customer.view");
    }
    if (
      !functionSet.has("customer.export") &&
      (normalizedRole === Role.FINANCE ||
        normalizedRole === Role.MANAGER ||
        normalizedRole === Role.ADMIN) &&
      menus.includes("/customers")
    ) {
      functionSet.add("customer.export");
    }
    if (
      !functionSet.has("supplier.view") &&
      (menus.includes("/suppliers") ||
        functions.some((key) => key.startsWith("supplier.")))
    ) {
      functionSet.add("supplier.view");
    }
    if (
      !functionSet.has("supplier.export") &&
      (normalizedRole === Role.FINANCE ||
        normalizedRole === Role.MANAGER ||
        normalizedRole === Role.ADMIN) &&
      menus.includes("/suppliers")
    ) {
      functionSet.add("supplier.export");
    }
    if (
      !functionSet.has("invoice.view") &&
      (menus.includes("/invoices") ||
        functions.some((key) => key.startsWith("invoice.")))
    ) {
      functionSet.add("invoice.view");
    }
    if (
      !functionSet.has("expense.view") &&
      (menus.includes("/expenses") ||
        functions.some((key) => key.startsWith("expense.")))
    ) {
      functionSet.add("expense.view");
    }
    if (
      !functionSet.has("expense.edit") &&
      (functionSet.has("expense.create") ||
        normalizedRole === Role.EMPLOYEE ||
        normalizedRole === Role.FINANCE ||
        normalizedRole === Role.ADMIN)
    ) {
      functionSet.add("expense.edit");
    }
    if (
      !functionSet.has("expense.submit") &&
      (functionSet.has("expense.create") ||
        normalizedRole === Role.EMPLOYEE ||
        normalizedRole === Role.FINANCE ||
        normalizedRole === Role.ADMIN)
    ) {
      functionSet.add("expense.submit");
    }
    if (
      !functionSet.has("expense.delete") &&
      (functionSet.has("expense.create") ||
        normalizedRole === Role.EMPLOYEE ||
        normalizedRole === Role.FINANCE ||
        normalizedRole === Role.ADMIN)
    ) {
      functionSet.add("expense.delete");
    }
    if (
      !functionSet.has("cost.view") &&
      (menus.includes("/costs") ||
        functions.some((key) => key.startsWith("cost.")))
    ) {
      functionSet.add("cost.view");
    }
    if (
      !functionSet.has("project.view") &&
      (menus.includes("/projects") ||
        functions.some((key) => key.startsWith("project.")))
    ) {
      functionSet.add("project.view");
    }
    if (
      !functionSet.has("budget.view") &&
      (menus.includes("/budgets") ||
        functions.some((key) => key.startsWith("budget.")))
    ) {
      functionSet.add("budget.view");
    }
    if (
      !functionSet.has("report.view") &&
      (menus.includes("/reports") ||
        functions.some((key) => key.startsWith("report.")))
    ) {
      functionSet.add("report.view");
    }
    if (
      !functionSet.has("payment-request.view") &&
      (menus.includes("/payment-requests") ||
        functions.some((key) => key.startsWith("payment-request.")))
    ) {
      functionSet.add("payment-request.view");
    }
    if (
      !functionSet.has("bank-account.view") &&
      (menus.includes("/payment-requests") ||
        functionSet.has("payment-request.view") ||
        functions.some((key) => key.startsWith("payment-request.")))
    ) {
      functionSet.add("bank-account.view");
    }
    if (
      !functionSet.has("bank-account.create") &&
      (functionSet.has("payment-request.create") ||
        functionSet.has("payment-request.edit"))
    ) {
      functionSet.add("bank-account.create");
    }
    if (
      !functionSet.has("bank-account.edit") &&
      (functionSet.has("payment-request.create") ||
        functionSet.has("payment-request.edit") ||
        functionSet.has("payment-request.confirm"))
    ) {
      functionSet.add("bank-account.edit");
    }
    if (
      normalizedRole === Role.FINANCE &&
      menus.includes("/costs") &&
      !functionSet.has("cost.create")
    ) {
      functionSet.add("cost.create");
      functionSet.add("cost.edit");
      functionSet.add("cost.delete");
    }
    if (
      normalizedRole === Role.ADMIN &&
      menus.includes("/costs") &&
      !functionSet.has("cost.create")
    ) {
      functionSet.add("cost.create");
      functionSet.add("cost.edit");
      functionSet.add("cost.delete");
    }
    if (
      (normalizedRole === Role.FINANCE ||
        normalizedRole === Role.MANAGER ||
        normalizedRole === Role.ADMIN) &&
      menus.includes("/contracts") &&
      !functionSet.has("contract.export")
    ) {
      functionSet.add("contract.export");
    }
    if (
      (normalizedRole === Role.FINANCE || normalizedRole === Role.ADMIN) &&
      menus.includes("/budgets") &&
      !functionSet.has("budget.freeze")
    ) {
      functionSet.add("budget.freeze");
      functionSet.add("budget.close");
    }
    if (
      normalizedRole === Role.ADMIN &&
      menus.includes("/budgets") &&
      !functionSet.has("budget.delete")
    ) {
      functionSet.add("budget.delete");
    }
    if (
      (normalizedRole === Role.FINANCE ||
        normalizedRole === Role.MANAGER ||
        normalizedRole === Role.ADMIN) &&
      menus.includes("/reports") &&
      !functionSet.has("report.export")
    ) {
      functionSet.add("report.export");
    }
    if (
      (normalizedRole === Role.FINANCE ||
        normalizedRole === Role.MANAGER ||
        normalizedRole === Role.ADMIN) &&
      menus.includes("/projects") &&
      !functionSet.has("project.create")
    ) {
      functionSet.add("project.create");
      functionSet.add("project.edit");
      functionSet.add("project.delete");
    }

    return { role, menus, functions: Array.from(functionSet) };
  }

  /**
   * 获取所有角色的权限配置
   */
  async getAllRolePermissions() {
    const roles = ["EMPLOYEE", "SALES", "FINANCE", "MANAGER", "ADMIN"];
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
    const normalizedRole = this.requireValidRole(role);
    const normalizedMenuKeys = this.normalizeMenuKeys(menuKeys || []);
    this.assertValidMenuKeys(normalizedMenuKeys);

    // 删除该角色的所有菜单权限
    await this.prisma.rolePermission.deleteMany({
      where: { role: normalizedRole, permType: "menu" },
    });

    // 创建新的菜单权限
    if (normalizedMenuKeys.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: normalizedMenuKeys.map((key) => ({
          role: normalizedRole,
          permType: "menu",
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
    const normalizedRole = this.requireValidRole(role);
    const normalizedFunctionKeys = Array.from(new Set(functionKeys || []));
    this.assertValidFunctionKeys(normalizedFunctionKeys);

    // 删除该角色的所有功能权限
    await this.prisma.rolePermission.deleteMany({
      where: { role: normalizedRole, permType: "function" },
    });

    // 创建新的功能权限
    if (normalizedFunctionKeys.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: normalizedFunctionKeys.map((key) => ({
          role: normalizedRole,
          permType: "function",
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
  async updateRolePermissions(
    role: string,
    menus: string[],
    functions: string[],
  ) {
    const normalizedRole = this.requireValidRole(role);
    const normalizedMenus = this.normalizeMenuKeys(menus || []);
    const normalizedFunctions = Array.from(new Set(functions || []));
    this.assertValidMenuKeys(normalizedMenus);
    this.assertValidFunctionKeys(normalizedFunctions);

    await this.prisma.$transaction([
      // 删除该角色的所有权限
      this.prisma.rolePermission.deleteMany({
        where: { role: normalizedRole },
      }),
      // 创建菜单权限
      this.prisma.rolePermission.createMany({
        data: [
          ...normalizedMenus.map((key) => ({
            role: normalizedRole,
            permType: "menu",
            permKey: key,
            isEnabled: true,
          })),
          ...normalizedFunctions.map((key) => ({
            role: normalizedRole,
            permType: "function",
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
    const normalizedRole = this.toRole(role);
    if (!normalizedRole) {
      return {
        role,
        menus: [],
        functions: [],
      };
    }

    await this.prisma.rolePermission.deleteMany({
      where: { role: normalizedRole },
    });

    return {
      role,
      menus: this.normalizeMenuKeys(DEFAULT_MENU_PERMISSIONS[role] || []),
      functions: DEFAULT_FUNCTION_PERMISSIONS[role] || [],
    };
  }

  /**
   * 初始化所有角色的默认权限到数据库
   */
  async initializeDefaultPermissions() {
    const roles = ["EMPLOYEE", "SALES", "FINANCE", "MANAGER", "ADMIN"];

    for (const role of roles) {
      const normalizedRole = this.requireValidRole(role);
      const existing = await this.prisma.rolePermission.findMany({
        where: { role: normalizedRole },
        select: { permType: true, permKey: true },
      });
      const existingMenus = new Set(
        existing
          .filter((item) => item.permType === "menu")
          .map((item) => item.permKey),
      );
      const existingFunctions = new Set(
        existing
          .filter((item) => item.permType === "function")
          .map((item) => item.permKey),
      );

      const menus = this.normalizeMenuKeys(
        DEFAULT_MENU_PERMISSIONS[role as keyof typeof DEFAULT_MENU_PERMISSIONS],
      );
      const functions =
        DEFAULT_FUNCTION_PERMISSIONS[
          role as keyof typeof DEFAULT_FUNCTION_PERMISSIONS
        ];

      const recordsToCreate = [
        ...menus
          .filter((key) => !existingMenus.has(key))
          .map((key) => ({
            role: normalizedRole,
            permType: "menu",
            permKey: key,
            isEnabled: true,
          })),
        ...functions
          .filter((key) => !existingFunctions.has(key))
          .map((key) => ({
            role: normalizedRole,
            permType: "function",
            permKey: key,
            isEnabled: true,
          })),
      ];

      if (recordsToCreate.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: recordsToCreate,
          skipDuplicates: true,
        });
      }
    }

    return { message: "初始化完成" };
  }
}
