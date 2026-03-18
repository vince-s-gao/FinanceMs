'use client';

// InfFinanceMs - 部门管理页面（树形结构）

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
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
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isActive: boolean;
}

interface Department {
  id: string;
  code: string;
  name: string;
  parentId?: string;
  parent?: {
    id: string;
    name: string;
    code: string;
  };
  children?: Department[];
  managerId?: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  members?: User[];
  sortOrder: number;
  isActive: boolean;
  remark?: string;
  _count?: {
    children: number;
    members: number;
  };
}

export default function DepartmentsPage() {
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<Department[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增部门');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 成员管理弹窗
  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [currentDepartment, setCurrentDepartment] = useState<Department | null>(null);
  const [departmentMembers, setDepartmentMembers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();

  // 加载部门树形结构
  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const res = await api.get<Department[]>('/departments/tree');
      setTreeData(res);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载所有部门（用于下拉选择）
  const fetchAllDepartments = async () => {
    try {
      const res = await api.get<Department[]>('/departments/options');
      setAllDepartments(res);
    } catch (error) {
      console.error('加载部门选项失败', error);
    }
  };

  // 加载所有用户
  const fetchAllUsers = async () => {
    try {
      const res = await api.get<User[]>('/users/options');
      setAllUsers(res || []);
    } catch (error) {
      console.error('加载用户列表失败', error);
    }
  };

  // 加载部门成员
  const fetchDepartmentMembers = async (departmentId: string) => {
    try {
      const res = await api.get<User[]>(`/departments/${departmentId}/members`);
      setDepartmentMembers(res);
    } catch (error) {
      console.error('加载部门成员失败', error);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchAllDepartments();
    fetchAllUsers();
  }, []);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle('新增部门');
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 添加子部门
  const handleAddChild = (parent: Department) => {
    setModalTitle(`新增子部门 - ${parent.name}`);
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ parentId: parent.id });
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Department) => {
    setModalTitle('编辑部门');
    setEditingId(record.id);
    form.setFieldsValue({
      name: record.name,
      parentId: record.parentId,
      sortOrder: record.sortOrder,
      remark: record.remark,
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingId) {
        await api.patch(`/departments/${editingId}`, values);
        message.success('更新成功');
      } else {
        await api.post('/departments', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchDepartments();
      fetchAllDepartments();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 启用/禁用
  const handleToggleActive = async (id: string) => {
    try {
      await api.patch(`/departments/${id}/toggle`);
      message.success('操作成功');
      fetchDepartments();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 删除部门
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/departments/${id}`);
      message.success('删除成功');
      fetchDepartments();
      fetchAllDepartments();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 打开成员管理弹窗
  const handleManageMembers = async (record: Department) => {
    setCurrentDepartment(record);
    await fetchDepartmentMembers(record.id);
    setMemberModalVisible(true);
  };

  // 添加成员
  const handleAddMember = async () => {
    if (!currentDepartment || !selectedUserId) return;
    try {
      await api.post(`/departments/${currentDepartment.id}/members/${selectedUserId}`);
      message.success('添加成功');
      await fetchDepartmentMembers(currentDepartment.id);
      fetchDepartments();
      setSelectedUserId(undefined);
    } catch (error: any) {
      message.error(error.message || '添加失败');
    }
  };

  // 移除成员
  const handleRemoveMember = async (userId: string) => {
    if (!currentDepartment) return;
    try {
      await api.delete(`/departments/${currentDepartment.id}/members/${userId}`);
      message.success('移除成功');
      await fetchDepartmentMembers(currentDepartment.id);
      fetchDepartments();
    } catch (error: any) {
      message.error(error.message || '移除失败');
    }
  };

  // 设置负责人
  const handleSetManager = async (userId: string | null) => {
    if (!currentDepartment) return;
    try {
      await api.patch(`/departments/${currentDepartment.id}/manager`, { userId });
      message.success(userId ? '设置成功' : '已取消负责人');
      fetchDepartments();
      setCurrentDepartment({ ...currentDepartment, managerId: userId || undefined });
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '部门编号',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '负责人',
      key: 'manager',
      width: 120,
      render: (_: any, record: Department) =>
        record.manager ? (
          <Tag color="blue">{record.manager.name}</Tag>
        ) : (
          <Text type="secondary">未设置</Text>
        ),
    },
    {
      title: '成员数',
      key: 'memberCount',
      width: 80,
      render: (_: any, record: Department) => record._count?.members || 0,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (isActive: boolean, record: Department) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record.id)}
          checkedChildren="启用"
          unCheckedChildren="禁用"
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: Department) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={() => handleManageMembers(record)}
          >
            成员管理
          </Button>
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddChild(record)}
          >
            子部门
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该部门吗？"
            description="删除后数据将无法恢复"
            onConfirm={() => handleDelete(record.id)}
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          部门管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增部门
        </Button>
      </div>

      {/* 表格 - 树形结构 */}
      <Table
        columns={columns}
        dataSource={treeData}
        rowKey="id"
        loading={loading}
        pagination={false}
        expandable={{
          defaultExpandAllRows: true,
          childrenColumnName: 'children',
        }}
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>

          <Form.Item name="parentId" label="上级部门">
            <Select
              placeholder="请选择上级部门（可选）"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              {allDepartments
                .filter((d) => d.id !== editingId)
                .map((d) => (
                  <Option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber
              placeholder="数字越小越靠前"
              min={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成员管理弹窗 */}
      <Modal
        title={`成员管理 - ${currentDepartment?.name || ''}`}
        open={memberModalVisible}
        onCancel={() => setMemberModalVisible(false)}
        footer={null}
        width={700}
      >
        {/* 添加成员 */}
        <div className="mb-4 flex gap-2">
          <Select
            placeholder="选择要添加的员工"
            value={selectedUserId}
            onChange={setSelectedUserId}
            style={{ width: 300 }}
            showSearch
            optionFilterProp="children"
            allowClear
          >
            {allUsers
              .filter((u) => !departmentMembers.find((m) => m.id === u.id))
              .map((u) => (
                <Option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </Option>
              ))}
          </Select>
          <Button type="primary" onClick={handleAddMember} disabled={!selectedUserId}>
            添加成员
          </Button>
        </div>

        {/* 成员列表 */}
        <Table
          dataSource={departmentMembers}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
            { title: '邮箱', dataIndex: 'email', key: 'email', width: 180 },
            { title: '电话', dataIndex: 'phone', key: 'phone', width: 120, render: (v: string) => v || '-' },
            {
              title: '负责人',
              key: 'isManager',
              width: 100,
              render: (_: any, record: User) =>
                currentDepartment?.managerId === record.id ? (
                  <Tag color="gold">负责人</Tag>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleSetManager(record.id)}
                  >
                    设为负责人
                  </Button>
                ),
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_: any, record: User) => (
                <Space>
                  {currentDepartment?.managerId === record.id && (
                    <Button
                      type="link"
                      size="small"
                      onClick={() => handleSetManager(null)}
                    >
                      取消负责人
                    </Button>
                  )}
          <Popconfirm
            title="确定移除该成员吗？"
            description="移除后该成员将不再属于此部门"
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
