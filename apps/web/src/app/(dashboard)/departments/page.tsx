'use client';

// InfFinanceMs - 员工管理页面（员工 + 部门）

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  message,
  Typography,
  Card,
  Modal,
  Form,
  Select,
  InputNumber,
  Popconfirm,
  Switch,
  Tabs,
  Input,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StopOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { ROLE_COLORS, ROLE_LABELS } from '@/lib/constants';
import { getErrorMessage } from '@/lib/error';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;
const { Option } = Select;

type StatusFilter = 'active' | 'inactive' | 'all';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: {
    id: string;
    name: string;
  } | null;
}

interface Employee {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: string;
  departmentId?: string | null;
  department?: {
    id: string;
    name: string;
    code: string;
  } | null;
  isActive: boolean;
  createdAt: string;
}

interface EmployeeListResponse {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface EmployeeFormValues {
  email: string;
  password?: string;
  name: string;
  phone?: string;
  role: 'EMPLOYEE' | 'FINANCE' | 'MANAGER' | 'ADMIN';
  departmentId?: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
  parentId?: string | null;
  parent?: {
    id: string;
    name: string;
    code: string;
  };
  children?: Department[];
  managerId?: string | null;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  members?: UserOption[];
  sortOrder: number;
  isActive: boolean;
  remark?: string;
  _count?: {
    children: number;
    members: number;
  };
}

interface DepartmentFormValues {
  name: string;
  parentId?: string;
  sortOrder?: number;
  remark?: string;
}

export default function EmployeeManagementPage() {
  const currentUser = useAuthStore((state) => state.user);

  // 员工管理状态
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageSize, setEmployeePageSize] = useState(20);
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState<string | undefined>();
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState<StatusFilter>('active');
  const [employeeModalVisible, setEmployeeModalVisible] = useState(false);
  const [employeeModalTitle, setEmployeeModalTitle] = useState('新增员工');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
  const [employeeForm] = Form.useForm<EmployeeFormValues>();

  // 部门管理状态
  const [departmentLoading, setDepartmentLoading] = useState(false);
  const [treeData, setTreeData] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [departmentModalVisible, setDepartmentModalVisible] = useState(false);
  const [departmentModalTitle, setDepartmentModalTitle] = useState('新增部门');
  const [editingDepartmentId, setEditingDepartmentId] = useState<string | null>(null);
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false);
  const [departmentForm] = Form.useForm<DepartmentFormValues>();

  // 成员管理弹窗
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(null);
  const [departmentMembers, setDepartmentMembers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  const fetchEmployees = useCallback(async () => {
    setEmployeeLoading(true);
    try {
      const isActive =
        employeeStatusFilter === 'all' ? undefined : employeeStatusFilter === 'active';
      const params: Record<string, unknown> = {
        page: employeePage,
        pageSize: employeePageSize,
      };
      if (employeeRoleFilter) params.role = employeeRoleFilter;
      if (isActive !== undefined) params.isActive = isActive;

      const res = await api.get<EmployeeListResponse>('/users', { params });
      setEmployees(res.items);
      setEmployeeTotal(res.total);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载员工失败'));
    } finally {
      setEmployeeLoading(false);
    }
  }, [employeePage, employeePageSize, employeeRoleFilter, employeeStatusFilter]);

  const fetchDepartmentTree = useCallback(async () => {
    setDepartmentLoading(true);
    try {
      const res = await api.get<Department[]>('/departments/tree');
      setTreeData(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载部门树失败'));
    } finally {
      setDepartmentLoading(false);
    }
  }, []);

  const fetchDepartmentOptions = useCallback(async () => {
    try {
      const res = await api.get<Department[]>('/departments/options');
      setAllDepartments(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载部门选项失败'));
    }
  }, []);

  const fetchUserOptions = useCallback(async () => {
    try {
      const res = await api.get<UserOption[]>('/users/options');
      setAllUsers(res || []);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载员工选项失败'));
    }
  }, []);

  const fetchDepartmentMembers = useCallback(async (departmentId: string) => {
    try {
      const res = await api.get<UserOption[]>(`/departments/${departmentId}/members`);
      setDepartmentMembers(res || []);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载部门成员失败'));
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    fetchDepartmentTree();
    fetchDepartmentOptions();
    fetchUserOptions();
  }, [fetchDepartmentTree, fetchDepartmentOptions, fetchUserOptions]);

  const handleAddEmployee = () => {
    setEmployeeModalTitle('新增员工');
    setEditingEmployeeId(null);
    employeeForm.resetFields();
    employeeForm.setFieldsValue({
      role: 'EMPLOYEE',
    });
    setEmployeeModalVisible(true);
  };

  const handleEditEmployee = (record: Employee) => {
    setEmployeeModalTitle('编辑员工');
    setEditingEmployeeId(record.id);
    employeeForm.setFieldsValue({
      email: record.email,
      password: undefined,
      name: record.name,
      phone: record.phone || undefined,
      role: record.role as EmployeeFormValues['role'],
      departmentId: record.departmentId || undefined,
    });
    setEmployeeModalVisible(true);
  };

  const handleSubmitEmployee = async () => {
    try {
      const values = await employeeForm.validateFields();
      setEmployeeSubmitting(true);

      if (editingEmployeeId) {
        const payload: Record<string, unknown> = {
          name: values.name,
          phone: values.phone,
          role: values.role,
          departmentId: values.departmentId || null,
        };
        if (values.password) payload.password = values.password;
        await api.patch(`/users/${editingEmployeeId}`, payload);
        message.success('员工信息已更新');
      } else {
        await api.post('/users', {
          ...values,
          departmentId: values.departmentId || null,
        });
        message.success('员工创建成功');
      }

      setEmployeeModalVisible(false);
      await Promise.all([fetchEmployees(), fetchDepartmentTree(), fetchUserOptions()]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '提交失败'));
    } finally {
      setEmployeeSubmitting(false);
    }
  };

  const handleToggleEmployeeActive = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/users/${id}`, { isActive: !isActive });
      message.success(isActive ? '已禁用员工' : '已启用员工');
      await fetchEmployees();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '状态更新失败'));
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('员工删除成功');
      await Promise.all([fetchEmployees(), fetchDepartmentTree(), fetchUserOptions()]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'));
    }
  };

  const handleAddDepartment = () => {
    setDepartmentModalTitle('新增部门');
    setEditingDepartmentId(null);
    departmentForm.resetFields();
    setDepartmentModalVisible(true);
  };

  const handleAddChildDepartment = (parent: Department) => {
    setDepartmentModalTitle(`新增子部门 - ${parent.name}`);
    setEditingDepartmentId(null);
    departmentForm.resetFields();
    departmentForm.setFieldsValue({ parentId: parent.id });
    setDepartmentModalVisible(true);
  };

  const handleEditDepartment = (record: Department) => {
    setDepartmentModalTitle('编辑部门');
    setEditingDepartmentId(record.id);
    departmentForm.setFieldsValue({
      name: record.name,
      parentId: record.parentId || undefined,
      sortOrder: record.sortOrder,
      remark: record.remark,
    });
    setDepartmentModalVisible(true);
  };

  const handleSubmitDepartment = async () => {
    try {
      const values = await departmentForm.validateFields();
      setDepartmentSubmitting(true);
      if (editingDepartmentId) {
        await api.patch(`/departments/${editingDepartmentId}`, values);
        message.success('部门更新成功');
      } else {
        await api.post('/departments', values);
        message.success('部门创建成功');
      }
      setDepartmentModalVisible(false);
      await Promise.all([fetchDepartmentTree(), fetchDepartmentOptions(), fetchEmployees(), fetchUserOptions()]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '提交失败'));
    } finally {
      setDepartmentSubmitting(false);
    }
  };

  const handleToggleDepartmentActive = async (id: string) => {
    try {
      await api.patch(`/departments/${id}/toggle`);
      message.success('部门状态已更新');
      await Promise.all([fetchDepartmentTree(), fetchDepartmentOptions()]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '操作失败'));
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    try {
      await api.delete(`/departments/${id}`);
      message.success('部门删除成功');
      await Promise.all([fetchDepartmentTree(), fetchDepartmentOptions(), fetchEmployees(), fetchUserOptions()]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '删除失败'));
    }
  };

  const handleManageDepartmentMembers = async (record: Department) => {
    setCurrentDepartment(record);
    setSelectedUserId(undefined);
    await fetchDepartmentMembers(record.id);
    setMemberModalVisible(true);
  };

  const handleAddMember = async () => {
    if (!currentDepartment || !selectedUserId) return;
    try {
      await api.post(`/departments/${currentDepartment.id}/members/${selectedUserId}`);
      message.success('成员添加成功');
      await Promise.all([
        fetchDepartmentMembers(currentDepartment.id),
        fetchDepartmentTree(),
        fetchEmployees(),
        fetchUserOptions(),
      ]);
      setSelectedUserId(undefined);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '添加失败'));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentDepartment) return;
    try {
      await api.delete(`/departments/${currentDepartment.id}/members/${userId}`);
      message.success('成员移除成功');
      await Promise.all([
        fetchDepartmentMembers(currentDepartment.id),
        fetchDepartmentTree(),
        fetchEmployees(),
        fetchUserOptions(),
      ]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '移除失败'));
    }
  };

  const handleSetManager = async (userId: string | null) => {
    if (!currentDepartment) return;
    try {
      await api.patch(`/departments/${currentDepartment.id}/manager`, { userId });
      message.success(userId ? '负责人设置成功' : '负责人已取消');
      setCurrentDepartment((prev) =>
        prev ? { ...prev, managerId: userId || undefined } : prev,
      );
      await Promise.all([
        fetchDepartmentTree(),
        fetchDepartmentMembers(currentDepartment.id),
        fetchEmployees(),
        fetchUserOptions(),
      ]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '设置失败'));
    }
  };

  const availableUsersForDepartment = useMemo(() => {
    const memberSet = new Set(departmentMembers.map((item) => item.id));
    return allUsers.filter((user) => !memberSet.has(user.id));
  }, [allUsers, departmentMembers]);

  const employeeColumns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 220,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (value: string | null | undefined) => value || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role] || role}</Tag>
      ),
    },
    {
      title: '部门',
      key: 'department',
      width: 180,
      render: (_: unknown, record: Employee) => record.department?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>{isActive ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_: unknown, record: Employee) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditEmployee(record)}>
            编辑
          </Button>
          <Popconfirm
            title={`确定${record.isActive ? '禁用' : '启用'}该员工吗？`}
            onConfirm={() => handleToggleEmployeeActive(record.id, record.isActive)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger={record.isActive}
              icon={record.isActive ? <StopOutlined /> : <CheckOutlined />}
            >
              {record.isActive ? '禁用' : '启用'}
            </Button>
          </Popconfirm>
          <Popconfirm
            title="确定删除该员工吗？"
            description="删除后该账号将被禁用，无法登录系统"
            onConfirm={() => handleDeleteEmployee(record.id)}
            okText="确定"
            cancelText="取消"
            disabled={record.id === currentUser?.id}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={record.id === currentUser?.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const departmentColumns = [
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
    },
    {
      title: '部门编号',
      dataIndex: 'code',
      key: 'code',
      width: 130,
    },
    {
      title: '负责人',
      key: 'manager',
      width: 140,
      render: (_: unknown, record: Department) =>
        record.manager ? <Tag color="blue">{record.manager.name}</Tag> : <Text type="secondary">未设置</Text>,
    },
    {
      title: '成员数',
      key: 'memberCount',
      width: 90,
      render: (_: unknown, record: Department) => record._count?.members || 0,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 120,
      render: (isActive: boolean, record: Department) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleDepartmentActive(record.id)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_: unknown, record: Department) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleManageDepartmentMembers(record)}>
            成员管理
          </Button>
          <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => handleAddChildDepartment(record)}>
            子部门
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditDepartment(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除该部门吗？"
            description="删除后将不可恢复"
            onConfirm={() => handleDeleteDepartment(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const employeeTab = (
    <Card>
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Input
            placeholder="按角色筛选"
            value={employeeRoleFilter || ''}
            onChange={(event) => {
              const role = event.target.value.trim().toUpperCase();
              setEmployeePage(1);
              setEmployeeRoleFilter(role || undefined);
            }}
            style={{ width: 180 }}
            allowClear
          />
          <Select
            value={employeeStatusFilter}
            style={{ width: 140 }}
            onChange={(value: StatusFilter) => {
              setEmployeePage(1);
              setEmployeeStatusFilter(value);
            }}
          >
            <Option value="active">仅启用</Option>
            <Option value="inactive">仅禁用</Option>
            <Option value="all">全部状态</Option>
          </Select>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddEmployee}>
          新增员工
        </Button>
      </div>

      <Table
        columns={employeeColumns}
        dataSource={employees}
        rowKey="id"
        loading={employeeLoading}
        scroll={{ x: 1220 }}
        pagination={{
          current: employeePage,
          pageSize: employeePageSize,
          total: employeeTotal,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (page, pageSize) => {
            setEmployeePage(page);
            setEmployeePageSize(pageSize);
          },
        }}
      />
    </Card>
  );

  const departmentTab = (
    <Card>
      <div className="flex justify-end mb-4">
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddDepartment}>
          新增部门
        </Button>
      </div>

      <Table
        columns={departmentColumns}
        dataSource={treeData}
        rowKey="id"
        loading={departmentLoading}
        pagination={false}
        scroll={{ x: 1220 }}
        expandable={{
          defaultExpandAllRows: true,
          childrenColumnName: 'children',
        }}
      />
    </Card>
  );

  return (
    <div>
      <Title level={4}>员工管理</Title>

      <Tabs
        className="mt-4"
        items={[
          {
            key: 'employees',
            label: '员工管理',
            children: employeeTab,
          },
          {
            key: 'departments',
            label: '部门管理',
            children: departmentTab,
          },
        ]}
      />

      <Modal
        title={employeeModalTitle}
        open={employeeModalVisible}
        onOk={handleSubmitEmployee}
        onCancel={() => setEmployeeModalVisible(false)}
        confirmLoading={employeeSubmitting}
        width={520}
      >
        <Form form={employeeForm} layout="vertical" className="mt-4">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" disabled={!!editingEmployeeId} />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={
              editingEmployeeId
                ? [{ min: 6, message: '密码长度不能少于6位' }]
                : [
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码长度不能少于6位' },
                  ]
            }
          >
            <Input.Password placeholder={editingEmployeeId ? '留空表示不修改' : '请输入初始密码'} />
          </Form.Item>

          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="请选择角色">
              <Option value="EMPLOYEE">员工</Option>
              <Option value="FINANCE">财务</Option>
              <Option value="MANAGER">管理层</Option>
              <Option value="ADMIN">管理员</Option>
            </Select>
          </Form.Item>

          <Form.Item name="departmentId" label="所属部门">
            <Select placeholder="请选择部门（可选）" allowClear showSearch optionFilterProp="children">
              {allDepartments.map((department) => (
                <Option key={department.id} value={department.id}>
                  {department.name} ({department.code})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={departmentModalTitle}
        open={departmentModalVisible}
        onOk={handleSubmitDepartment}
        onCancel={() => setDepartmentModalVisible(false)}
        confirmLoading={departmentSubmitting}
        width={520}
      >
        <Form form={departmentForm} layout="vertical" className="mt-4">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="请输入部门名称" />
          </Form.Item>

          <Form.Item name="parentId" label="上级部门">
            <Select placeholder="请选择上级部门（可选）" allowClear showSearch optionFilterProp="children">
              {allDepartments
                .filter((department) => department.id !== editingDepartmentId)
                .map((department) => (
                  <Option key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber placeholder="数字越小越靠前" min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`成员管理 - ${currentDepartment?.name || ''}`}
        open={memberModalVisible}
        onCancel={() => setMemberModalVisible(false)}
        footer={null}
        width={760}
      >
        <div className="mb-4 flex gap-2">
          <Select
            placeholder="选择要添加的员工"
            value={selectedUserId}
            onChange={setSelectedUserId}
            style={{ width: 320 }}
            showSearch
            optionFilterProp="children"
            allowClear
          >
            {availableUsersForDepartment.map((user) => (
              <Option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </Option>
            ))}
          </Select>
          <Button type="primary" onClick={handleAddMember} disabled={!selectedUserId}>
            添加成员
          </Button>
        </div>

        <Table
          dataSource={departmentMembers}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '姓名', dataIndex: 'name', key: 'name', width: 140 },
            { title: '邮箱', dataIndex: 'email', key: 'email', width: 220 },
            {
              title: '角色',
              dataIndex: 'role',
              key: 'role',
              width: 110,
              render: (role: string) => ROLE_LABELS[role] || role,
            },
            {
              title: '负责人',
              key: 'isManager',
              width: 130,
              render: (_: unknown, record: UserOption) =>
                currentDepartment?.managerId === record.id ? (
                  <Tag color="gold">负责人</Tag>
                ) : (
                  <Button type="link" size="small" onClick={() => handleSetManager(record.id)}>
                    设为负责人
                  </Button>
                ),
            },
            {
              title: '操作',
              key: 'action',
              width: 180,
              render: (_: unknown, record: UserOption) => (
                <Space>
                  {currentDepartment?.managerId === record.id && (
                    <Button type="link" size="small" onClick={() => handleSetManager(null)}>
                      取消负责人
                    </Button>
                  )}
                  <Popconfirm
                    title="确定移除该成员吗？"
                    description="移除后该成员不再属于当前部门"
                    onConfirm={() => handleRemoveMember(record.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button type="link" size="small" danger>
                      移除
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
