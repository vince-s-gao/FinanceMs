'use client';

// InfFinanceMs - 系统设置页面

import { useEffect, useState } from 'react';
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
  Input,
  Select,
  Popconfirm,
  Tabs,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  StopOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { ROLE_LABELS, ROLE_COLORS } from '@/lib/constants';

const { Title, Text } = Typography;
const { Option } = Select;

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增用户');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 加载用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/users', { params: { page, pageSize } });
      setUsers(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle('新增用户');
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: User) => {
    setModalTitle('编辑用户');
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      password: undefined, // 编辑时不显示密码
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingId) {
        // 如果密码为空，不更新密码
        if (!values.password) {
          delete values.password;
        }
        await api.patch(`/users/${editingId}`, values);
        message.success('更新成功');
      } else {
        await api.post('/users', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchUsers();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 禁用/启用用户
  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.patch(`/users/${id}`, { isActive: !isActive });
      message.success(isActive ? '已禁用' : '已启用');
      fetchUsers();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (v: string) => v || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (role: string) => (
        <Tag color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Tag>
      ),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 100,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '正常' : '禁用'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: User) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title={`确定${record.isActive ? '禁用' : '启用'}该用户吗？`}
            onConfirm={() => handleToggleActive(record.id, record.isActive)}
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
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'users',
      label: '用户管理',
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              新增用户
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (t) => `共 ${t} 条`,
              onChange: (p, ps) => {
                setPage(p);
                setPageSize(ps);
              },
            }}
          />
        </div>
      ),
    },
    {
      key: 'system',
      label: '系统信息',
      children: (
        <Card>
          <div className="space-y-4">
            <div className="flex justify-between">
              <Text type="secondary">系统名称</Text>
              <Text strong>InfFinanceMs</Text>
            </div>
            <div className="flex justify-between">
              <Text type="secondary">版本号</Text>
              <Text>V1.0.0</Text>
            </div>
            <div className="flex justify-between">
              <Text type="secondary">技术栈</Text>
              <Text>Next.js + NestJS + PostgreSQL + Prisma</Text>
            </div>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <div>
      <Title level={4}>系统设置</Title>

      <Tabs items={tabItems} className="mt-4" />

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
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" disabled={!!editingId} />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={
              editingId
                ? []
                : [
                    { required: true, message: '请输入密码' },
                    { min: 6, message: '密码长度不能少于6位' },
                  ]
            }
          >
            <Input.Password
              placeholder={editingId ? '不修改请留空' : '请输入密码'}
            />
          </Form.Item>

          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>

          <Form.Item name="phone" label="手机号">
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              <Option value="EMPLOYEE">员工</Option>
              <Option value="FINANCE">财务</Option>
              <Option value="MANAGER">管理层</Option>
              <Option value="ADMIN">管理员</Option>
            </Select>
          </Form.Item>

          <Form.Item name="department" label="部门">
            <Input placeholder="请输入部门" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
