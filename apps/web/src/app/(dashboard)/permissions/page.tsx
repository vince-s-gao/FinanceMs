"use client";

// InfFinanceMs - 权限管理页面

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Table,
  Tag,
  Typography,
  Tabs,
  Switch,
  Button,
  message,
  Space,
  Tooltip,
  Checkbox,
  Modal,
  Spin,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { ROLE_LABELS, ROLE_COLORS } from "@/lib/constants";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";

const { Title, Text, Paragraph } = Typography;

// 角色列表
const ROLES = ["EMPLOYEE", "SALES", "FINANCE", "MANAGER", "ADMIN"];

type RolePermissions = { menus: string[]; functions: string[] };
type RolePermissionsMatrix = Record<string, RolePermissions>;

interface MenuPermission {
  key: string;
  name: string;
  description: string;
}

interface FunctionPermission {
  key: string;
  name: string;
  module: string;
}

// 菜单权限配置
const MENU_PERMISSIONS: MenuPermission[] = [
  { key: "/dashboard", name: "工作台", description: "首页数据概览" },
  { key: "/customers", name: "客户管理", description: "客户信息维护" },
  { key: "/suppliers", name: "供应商管理", description: "供应商主数据维护" },
  { key: "/contracts", name: "合同管理", description: "合同全生命周期管理" },
  { key: "/payments", name: "回款管理", description: "回款计划与记录" },
  {
    key: "/payment-requests",
    name: "付款申请",
    description: "付款申请与审批流转",
  },
  {
    key: "/invoices",
    name: "发票管理",
    description: "发票管理（进项/出项页签）",
  },
  { key: "/expenses", name: "报销管理", description: "报销申请与审批" },
  { key: "/costs", name: "费用管理", description: "费用录入与统计" },
  { key: "/budgets", name: "预算管理", description: "部门预算管理" },
  { key: "/reports", name: "报表看板", description: "数据统计与分析" },
  { key: "/projects", name: "项目管理", description: "项目主数据管理" },
  { key: "/departments", name: "员工管理", description: "员工与组织架构管理" },
  { key: "/settings", name: "系统设置", description: "用户与系统配置" },
  {
    key: "/settings/dictionaries",
    name: "数据字典",
    description: "字典项维护",
  },
  { key: "/permissions", name: "权限管理", description: "角色权限配置" },
  { key: "/audit-logs", name: "日志管理", description: "登录与增删改日志审计" },
];

// 功能权限配置
const FUNCTION_PERMISSIONS: FunctionPermission[] = [
  { key: "expense.view", name: "查看报销", module: "报销管理" },
  { key: "expense.create", name: "创建报销", module: "报销管理" },
  { key: "expense.edit", name: "编辑报销", module: "报销管理" },
  { key: "expense.submit", name: "提交报销", module: "报销管理" },
  { key: "expense.delete", name: "删除报销", module: "报销管理" },
  { key: "expense.approve", name: "审批报销", module: "报销管理" },
  { key: "expense.pay", name: "报销打款", module: "报销管理" },
  { key: "contract.view", name: "查看合同", module: "合同管理" },
  { key: "contract.export", name: "导出合同", module: "合同管理" },
  { key: "contract.create", name: "创建合同", module: "合同管理" },
  { key: "contract.edit", name: "编辑合同", module: "合同管理" },
  { key: "contract.delete", name: "删除合同", module: "合同管理" },
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
  { key: "payment-request.view", name: "查看付款申请", module: "付款申请" },
  { key: "payment-request.create", name: "创建付款申请", module: "付款申请" },
  { key: "payment-request.edit", name: "编辑付款申请", module: "付款申请" },
  { key: "payment-request.submit", name: "提交付款申请", module: "付款申请" },
  { key: "payment-request.approve", name: "审批付款申请", module: "付款申请" },
  { key: "payment-request.confirm", name: "确认付款", module: "付款申请" },
  { key: "payment-request.cancel", name: "取消付款申请", module: "付款申请" },
  { key: "payment-request.delete", name: "删除付款申请", module: "付款申请" },
  { key: "bank-account.view", name: "查看收款账户", module: "付款申请" },
  { key: "bank-account.create", name: "创建收款账户", module: "付款申请" },
  { key: "bank-account.edit", name: "编辑收款账户", module: "付款申请" },
  { key: "bank-account.delete", name: "删除收款账户", module: "付款申请" },
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

// 角色功能权限矩阵（已移至动态加载）
const ROLE_MENU_MATRIX_DEFAULT: Record<
  string,
  { menus: string[]; functions: string[] }
> = {
  EMPLOYEE: {
    menus: ["/dashboard", "/expenses"],
    functions: [
      "expense.view",
      "expense.create",
      "expense.edit",
      "expense.submit",
      "expense.delete",
    ],
  },
  SALES: {
    menus: [
      "/dashboard",
      "/customers",
      "/contracts",
      "/payments",
      "/expenses",
      "/projects",
    ],
    functions: [
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
  },
  FINANCE: {
    menus: [
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
    functions: [
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
      "contract.view",
      "contract.export",
      "invoice.create",
      "invoice.void",
      "budget.view",
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
  },
  MANAGER: {
    menus: [
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
    functions: [
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
  },
  ADMIN: {
    menus: MENU_PERMISSIONS.map((m) => m.key),
    functions: FUNCTION_PERMISSIONS.map((f) => f.key),
  },
};

export default function PermissionsPage() {
  const [activeTab, setActiveTab] = useState("menu");
  const [loading, setLoading] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionsMatrix>(
    {},
  );
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editingMenus, setEditingMenus] = useState<string[]>([]);
  const [editingFunctions, setEditingFunctions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // 加载权限配置
  const fetchPermissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<RolePermissionsMatrix>("/permissions/roles");
      setRolePermissions(res);
    } catch (error) {
      // 使用默认配置
      setRolePermissions(ROLE_MENU_MATRIX_DEFAULT);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // 获取当前权限矩阵
  const getCurrentMatrix = () => {
    return Object.keys(rolePermissions).length > 0
      ? rolePermissions
      : ROLE_MENU_MATRIX_DEFAULT;
  };

  // 打开编辑弹窗
  const handleEdit = (role: string) => {
    const matrix = getCurrentMatrix();
    setEditingRole(role);
    setEditingMenus(matrix[role]?.menus || []);
    setEditingFunctions(matrix[role]?.functions || []);
    setEditModalVisible(true);
  };

  // 保存权限
  const handleSave = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await api.post(`/permissions/roles/${editingRole}`, {
        menus: editingMenus,
        functions: editingFunctions,
      });
      message.success("保存成功");
      setEditModalVisible(false);
      fetchPermissions();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "保存失败"));
    } finally {
      setSaving(false);
    }
  };

  // 重置权限
  const handleReset = async (role: string) => {
    try {
      await api.post(`/permissions/roles/${role}/reset`);
      message.success("已重置为默认权限");
      fetchPermissions();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "重置失败"));
    }
  };

  // 菜单权限表格列
  const menuColumns: TableColumnsType<MenuPermission> = [
    {
      title: "菜单",
      dataIndex: "name",
      key: "name",
      width: 150,
      fixed: "left" as const,
      render: (name: string, record: MenuPermission) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-gray-400">{record.description}</div>
        </div>
      ),
    },
    ...ROLES.map((role) => ({
      title: (
        <div className="text-center">
          <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
          <div className="mt-1">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(role)}
            >
              编辑
            </Button>
          </div>
        </div>
      ),
      key: role,
      width: 120,
      align: "center" as const,
      render: (_: unknown, record: MenuPermission) => {
        const matrix = getCurrentMatrix();
        const hasPermission = matrix[role]?.menus?.includes(record.key);
        return hasPermission ? (
          <CheckCircleOutlined className="text-green-500 text-lg" />
        ) : (
          <CloseCircleOutlined className="text-gray-300 text-lg" />
        );
      },
    })),
  ];

  // 功能权限表格列
  const functionColumns: TableColumnsType<FunctionPermission> = [
    {
      title: "功能",
      dataIndex: "name",
      key: "name",
      width: 120,
      fixed: "left" as const,
    },
    {
      title: "所属模块",
      dataIndex: "module",
      key: "module",
      width: 100,
      fixed: "left" as const,
      render: (module: string) => <Tag>{module}</Tag>,
    },
    ...ROLES.map((role) => ({
      title: <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>,
      key: role,
      width: 100,
      align: "center" as const,
      render: (_: unknown, record: FunctionPermission) => {
        const matrix = getCurrentMatrix();
        const hasPermission = matrix[role]?.functions?.includes(record.key);
        return hasPermission ? (
          <CheckCircleOutlined className="text-green-500 text-lg" />
        ) : (
          <CloseCircleOutlined className="text-gray-300 text-lg" />
        );
      },
    })),
  ];

  // 角色说明数据
  const roleDescriptions = [
    {
      role: "EMPLOYEE",
      name: "普通员工",
      description: "基础权限，可以提交报销申请，查看个人相关数据",
      color: ROLE_COLORS.EMPLOYEE,
    },
    {
      role: "SALES",
      name: "销售人员",
      description: "负责客户开发和合同签订，可以管理客户、合同和回款信息",
      color: ROLE_COLORS.SALES,
    },
    {
      role: "FINANCE",
      name: "财务人员",
      description: "负责财务相关工作，可以审批报销、开具发票、管理预算等",
      color: ROLE_COLORS.FINANCE,
    },
    {
      role: "MANAGER",
      name: "管理层",
      description: "部门或公司管理者，可以查看报表、审批报销等",
      color: ROLE_COLORS.MANAGER,
    },
    {
      role: "ADMIN",
      name: "系统管理员",
      description: "拥有系统全部权限，可以管理用户、部门和系统配置",
      color: ROLE_COLORS.ADMIN,
    },
  ];

  const tabItems = [
    {
      key: "menu",
      label: "菜单权限",
      children: (
        <Table
          columns={menuColumns}
          dataSource={MENU_PERMISSIONS}
          rowKey="key"
          pagination={false}
          scroll={{ x: 900 }}
          bordered
          size="middle"
        />
      ),
    },
    {
      key: "function",
      label: "功能权限",
      children: (
        <Table
          columns={functionColumns}
          dataSource={FUNCTION_PERMISSIONS}
          rowKey="key"
          pagination={false}
          scroll={{ x: 900 }}
          bordered
          size="middle"
        />
      ),
    },
    {
      key: "roles",
      label: "角色说明",
      children: (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roleDescriptions.map((item) => (
            <Card key={item.role} size="small">
              <div className="flex items-start gap-3">
                <Tag color={item.color} className="mt-1">
                  {item.name}
                </Tag>
                <div>
                  <Text strong>{item.name}</Text>
                  <Paragraph className="text-gray-500 text-sm mb-0 mt-1">
                    {item.description}
                  </Paragraph>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <Title level={4} className="!mb-1">
            权限管理
          </Title>
          <Text type="secondary">
            查看系统角色权限配置，了解各角色可访问的功能模块
          </Text>
        </div>
        <Tooltip title="权限配置目前为系统预设，如需调整请联系开发人员">
          <Button icon={<InfoCircleOutlined />}>权限说明</Button>
        </Tooltip>
      </div>

      <Spin spinning={loading}>
        <Card>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Card>
      </Spin>

      <Card className="mt-4" size="small">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">图例：</span>
          <span className="flex items-center gap-1">
            <CheckCircleOutlined className="text-green-500" />
            有权限
          </span>
          <span className="flex items-center gap-1">
            <CloseCircleOutlined className="text-gray-300" />
            无权限
          </span>
        </div>
      </Card>

      {/* 编辑权限弹窗 */}
      <Modal
        title={`编辑权限 - ${editingRole ? ROLE_LABELS[editingRole] : ""}`}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        width={700}
        footer={[
          <Button
            key="reset"
            onClick={() => editingRole && handleReset(editingRole)}
          >
            重置为默认
          </Button>,
          <Button key="cancel" onClick={() => setEditModalVisible(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={handleSave}
            icon={<SaveOutlined />}
          >
            保存
          </Button>,
        ]}
      >
        <div className="space-y-6">
          {/* 菜单权限 */}
          <div>
            <Title level={5}>菜单权限</Title>
            <div className="grid grid-cols-3 gap-2">
              {MENU_PERMISSIONS.map((menu) => (
                <Checkbox
                  key={menu.key}
                  checked={editingMenus.includes(menu.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEditingMenus([...editingMenus, menu.key]);
                    } else {
                      setEditingMenus(
                        editingMenus.filter((k) => k !== menu.key),
                      );
                    }
                  }}
                >
                  {menu.name}
                </Checkbox>
              ))}
            </div>
          </div>

          {/* 功能权限 */}
          <div>
            <Title level={5}>功能权限</Title>
            <div className="grid grid-cols-3 gap-2">
              {FUNCTION_PERMISSIONS.map((func) => (
                <Checkbox
                  key={func.key}
                  checked={editingFunctions.includes(func.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEditingFunctions([...editingFunctions, func.key]);
                    } else {
                      setEditingFunctions(
                        editingFunctions.filter((k) => k !== func.key),
                      );
                    }
                  }}
                >
                  {func.name}
                </Checkbox>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
