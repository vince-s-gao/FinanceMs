'use client';

// InfFinanceMs - 数据字典管理页面

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
  InputNumber,
  Switch,
  Select,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';

const { Title } = Typography;
const { Option } = Select;

interface Dictionary {
  id: string;
  type: string;
  code: string;
  name: string;
  value?: string;
  color?: string;
  sortOrder: number;
  isDefault: boolean;
  isEnabled: boolean;
  remark?: string;
  createdAt: string;
}

// 预定义的颜色选项
const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'red', label: '红色' },
  { value: 'orange', label: '橙色' },
  { value: 'purple', label: '紫色' },
  { value: 'cyan', label: '青色' },
  { value: 'gold', label: '金色' },
  { value: 'default', label: '默认' },
];

// 预定义的字典类型
const DICT_TYPES = [
  { value: 'CUSTOMER_TYPE', label: '客户类型' },
  { value: 'EXPENSE_TYPE', label: '报销类型' },
];

export default function DictionariesPage() {
  const [loading, setLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('CUSTOMER_TYPE');

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增字典项');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 加载字典列表
  const fetchDictionaries = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (typeFilter) params.type = typeFilter;

      const res = await api.get<Dictionary[]>('/dictionaries', { params });
      setDictionaries(res);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDictionaries();
  }, [typeFilter]);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle('新增字典项');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      type: typeFilter,
      sortOrder: 0,
      isDefault: false,
      isEnabled: true,
    });
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Dictionary) => {
    setModalTitle('编辑字典项');
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingId) {
        await api.patch(`/dictionaries/${editingId}`, values);
        message.success('更新成功');
      } else {
        await api.post('/dictionaries', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchDictionaries();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除字典项
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/dictionaries/${id}`);
      message.success('删除成功');
      fetchDictionaries();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 初始化默认客户类型
  const handleInitCustomerTypes = async () => {
    try {
      await api.post('/dictionaries/init-customer-types');
      message.success('初始化成功');
      fetchDictionaries();
    } catch (error: any) {
      message.error(error.message || '初始化失败');
    }
  };

  // 初始化默认报销类型
  const handleInitExpenseTypes = async () => {
    try {
      await api.post('/dictionaries/init-expense-types');
      message.success('初始化成功');
      fetchDictionaries();
    } catch (error: any) {
      message.error(error.message || '初始化失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '编码',
      dataIndex: 'code',
      key: 'code',
      width: 150,
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (name: string, record: Dictionary) => (
        <Tag color={record.color || 'default'}>{name}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '默认值',
      dataIndex: 'isDefault',
      key: 'isDefault',
      width: 80,
      render: (v: boolean) => (v ? <Tag color="blue">是</Tag> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: 80,
      render: (v: boolean) => (
        <Tag color={v ? 'green' : 'red'}>{v ? '启用' : '禁用'}</Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: Dictionary) => (
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
            title="确定删除该字典项吗？"
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
          数据字典管理
        </Title>
        <Space>
          <Button onClick={handleInitCustomerTypes}>
            初始化客户类型
          </Button>
          <Button onClick={handleInitExpenseTypes}>
            初始化报销类型
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增字典项
          </Button>
        </Space>
      </div>

      {/* 筛选栏 */}
      <Card className="mb-4">
        <Space wrap>
          <span>字典类型：</span>
          <Select
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 200 }}
          >
            {DICT_TYPES.map((type) => (
              <Option key={type.value} value={type.value}>
                {type.label}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={dictionaries}
        rowKey="id"
        loading={loading}
        pagination={false}
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
            name="type"
            label="字典类型"
            rules={[{ required: true, message: '请选择字典类型' }]}
          >
            <Select placeholder="请选择字典类型" disabled={!!editingId}>
              {DICT_TYPES.map((type) => (
                <Option key={type.value} value={type.value}>
                  {type.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="code"
            label="编码"
            rules={[
              { required: true, message: '请输入编码' },
              { pattern: /^[A-Z_]+$/, message: '编码只能包含大写字母和下划线' },
            ]}
          >
            <Input placeholder="请输入编码（如：ENTERPRISE）" disabled={!!editingId} />
          </Form.Item>

          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          >
            <Input placeholder="请输入名称（如：企业）" />
          </Form.Item>

          <Form.Item name="color" label="显示颜色">
            <Select placeholder="请选择颜色" allowClear>
              {COLOR_OPTIONS.map((color) => (
                <Option key={color.value} value={color.value}>
                  <Tag color={color.value}>{color.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} placeholder="排序值，越小越靠前" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="isDefault" label="是否默认值" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="isEnabled" label="是否启用" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
