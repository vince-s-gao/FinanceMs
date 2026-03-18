'use client';

// InfFinanceMs - 客户管理页面

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Typography,
  Card,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { APPROVAL_STATUS_LABELS, APPROVAL_STATUS_COLORS } from '@/lib/constants';

const { Title } = Typography;
const { Option } = Select;

// 客户类型字典项接口
interface DictionaryItem {
  id: string;
  code: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  creditCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  remark?: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalRemark?: string;
  _count?: {
    contracts: number;
  };
}

export default function CustomersPage() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  // 客户类型字典
  const [customerTypes, setCustomerTypes] = useState<DictionaryItem[]>([]);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增客户');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 加载客户类型字典
  const fetchCustomerTypes = async () => {
    try {
      const res = await api.get<DictionaryItem[]>('/dictionaries/by-type/CUSTOMER_TYPE');
      setCustomerTypes(res);
    } catch (error) {
      console.error('加载客户类型失败', error);
      // 使用默认值
      setCustomerTypes([
        { id: '1', code: 'ENTERPRISE', name: '企业', color: 'blue' },
        { id: '2', code: 'INDIVIDUAL', name: '个人', color: 'green' },
      ]);
    }
  };

  // 根据code获取客户类型信息
  const getCustomerType = (code: string) => {
    return customerTypes.find((t) => t.code === code) || { code, name: code, color: 'default' };
  };

  // 加载客户列表
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (typeFilter) params.type = typeFilter;

      const res = await api.get<any>('/customers', { params });
      setCustomers(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerTypes();
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [page, pageSize, keyword, typeFilter]);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle('新增客户');
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Customer) => {
    setModalTitle('编辑客户');
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
        await api.patch(`/customers/${editingId}`, values);
        message.success('更新成功');
      } else {
        await api.post('/customers', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchCustomers();
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 删除客户
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/customers/${id}`);
      message.success('删除成功');
      fetchCustomers();
    } catch (error: any) {
      message.error(error.response?.data?.message || '删除失败');
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/customers/${id}/approve`, {
        approved,
        remark: approved ? undefined : '审批驳回',
      });
      message.success(approved ? '审批通过' : '已驳回');
      fetchCustomers();
    } catch (error: any) {
      message.error(error.response?.data?.message || '审批失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '客户编号',
      dataIndex: 'code',
      key: 'code',
      width: 120,
    },
    {
      title: '客户名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '客户类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        const typeInfo = getCustomerType(type);
        return (
          <Tag color={typeInfo.color || 'default'}>
            {typeInfo.name}
          </Tag>
        );
      },
    },
    {
      title: '审批状态',
      dataIndex: 'approvalStatus',
      key: 'approvalStatus',
      width: 100,
      render: (status: string) => (
        <Tag color={APPROVAL_STATUS_COLORS[status] || 'default'}>
          {APPROVAL_STATUS_LABELS[status] || '-'}
        </Tag>
      ),
    },
    {
      title: '联系人',
      dataIndex: 'contactName',
      key: 'contactName',
      width: 100,
    },
    {
      title: '联系电话',
      dataIndex: 'contactPhone',
      key: 'contactPhone',
      width: 130,
    },
    {
      title: '合同数',
      dataIndex: ['_count', 'contracts'],
      key: 'contracts',
      width: 80,
      render: (v: number) => v || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Customer) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {}}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {/* 待审批状态显示审批按钮 */}
          {record.approvalStatus === 'PENDING' && (
            <>
              <Popconfirm
                title="确定通过该客户吗？"
                onConfirm={() => handleApprove(record.id, true)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定驳回该客户吗？"
                onConfirm={() => handleApprove(record.id, false)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger icon={<CloseOutlined />}>
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="确定删除该客户吗？"
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
          客户管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增客户
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索客户名称/编号/联系人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="客户类型"
            value={typeFilter}
            onChange={setTypeFilter}
            style={{ width: 120 }}
            allowClear
          >
            {customerTypes.map((type) => (
              <Option key={type.code} value={type.code}>
                {type.name}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={customers}
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

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: '请输入客户名称' }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="客户类型"
            rules={[{ required: true, message: '请选择客户类型' }]}
          >
            <Select placeholder="请选择客户类型">
              {customerTypes.map((type) => (
                <Option key={type.code} value={type.code}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="creditCode"
            label="统一社会信用代码"
            rules={[
              {
                pattern: /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/,
                message: '请输入有效的统一社会信用代码',
              },
            ]}
          >
            <Input placeholder="请输入统一社会信用代码" />
          </Form.Item>

          <Form.Item name="contactName" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>

          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[
              {
                pattern: /^1[3-9]\d{9}$/,
                message: '请输入有效的手机号',
              },
            ]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            name="contactEmail"
            label="联系邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input.TextArea placeholder="请输入地址" rows={2} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
