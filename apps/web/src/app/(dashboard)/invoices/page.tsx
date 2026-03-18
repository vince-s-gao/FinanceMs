'use client';

// InfFinanceMs - 发票管理页面

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Select,
  message,
  Typography,
  Card,
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import {
  INVOICE_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  formatAmount,
  formatDate,
} from '@/lib/constants';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number;
  invoiceDate: string;
  status: string;
  contract: {
    id: string;
    contractNo: string;
    name: string;
    customer: {
      id: string;
      name: string;
    };
  };
}

interface Contract {
  id: string;
  contractNo: string;
  name: string;
}

export default function InvoicesPage() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 加载发票列表
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<any>('/invoices', { params });
      setInvoices(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载合同列表（用于下拉选择）
  const fetchContracts = async () => {
    try {
      const res = await api.get<any>('/contracts', { params: { pageSize: 100, status: 'EXECUTING' } });
      setContracts(res.items);
    } catch (error) {
      console.error('加载合同列表失败', error);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, keyword, statusFilter]);

  // 打开新增弹窗
  const handleAdd = () => {
    fetchContracts();
    form.resetFields();
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      await api.post('/invoices', {
        ...values,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
      });
      message.success('创建成功');

      setModalVisible(false);
      fetchInvoices();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 作废发票
  const handleVoid = async (id: string) => {
    try {
      await api.patch(`/invoices/${id}/void`);
      message.success('作废成功');
      fetchInvoices();
    } catch (error: any) {
      message.error(error.message || '作废失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '发票号码',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 150,
    },
    {
      title: '合同',
      key: 'contract',
      width: 200,
      ellipsis: true,
      render: (_: any, record: Invoice) => (
        <div>
          <div>{record.contract.contractNo}</div>
          <Text type="secondary" className="text-xs">
            {record.contract.name}
          </Text>
        </div>
      ),
    },
    {
      title: '客户',
      dataIndex: ['contract', 'customer', 'name'],
      key: 'customer',
      width: 150,
      ellipsis: true,
    },
    {
      title: '发票类型',
      dataIndex: 'invoiceType',
      key: 'invoiceType',
      width: 130,
      render: (v: string) => INVOICE_TYPE_LABELS[v],
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => (
        <Text strong>¥{formatAmount(v)}</Text>
      ),
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 100,
      render: (v: number) => (v ? `¥${formatAmount(v)}` : '-'),
    },
    {
      title: '开票日期',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={INVOICE_STATUS_COLORS[status]}>
          {INVOICE_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Invoice) => (
        record.status === 'ISSUED' && (
      <Popconfirm
        title="确定作废该发票吗？"
        description="作废后该发票将无法恢复"
        onConfirm={() => handleVoid(record.id)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="link" size="small" danger icon={<StopOutlined />}>
          作废
        </Button>
      </Popconfirm>
        )
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          发票管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增发票
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索发票号/合同编号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="发票状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="ISSUED">已开具</Option>
            <Option value="VOIDED">已作废</Option>
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={invoices}
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
        scroll={{ x: 1100 }}
      />

      {/* 新增弹窗 */}
      <Modal
        title="新增发票"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="contractId"
            label="关联合同"
            rules={[{ required: true, message: '请选择合同' }]}
          >
            <Select placeholder="请选择合同" showSearch optionFilterProp="children">
              {contracts.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.contractNo} - {c.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="invoiceNo"
            label="发票号码"
            rules={[{ required: true, message: '请输入发票号码' }]}
          >
            <Input placeholder="请输入发票号码" />
          </Form.Item>

          <Form.Item
            name="invoiceType"
            label="发票类型"
            rules={[{ required: true, message: '请选择发票类型' }]}
          >
            <Select placeholder="请选择发票类型">
              <Option value="VAT_SPECIAL">增值税专用发票</Option>
              <Option value="VAT_NORMAL">增值税普通发票</Option>
              <Option value="RECEIPT">收据</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="发票金额"
            rules={[{ required: true, message: '请输入发票金额' }]}
          >
            <InputNumber
              placeholder="请输入发票金额"
              min={0.01}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/[¥,]/g, '') as any}
            />
          </Form.Item>

          <Form.Item name="taxAmount" label="税额">
            <InputNumber
              placeholder="请输入税额"
              min={0}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/[¥,]/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="invoiceDate"
            label="开票日期"
            rules={[{ required: true, message: '请选择开票日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
