'use client';

// InfFinanceMs - 付款申请列表页面
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Card,
  message,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// 付款申请状态映射
const statusMap: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审批', color: 'processing' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已拒绝', color: 'error' },
  PAID: { label: '已付款', color: 'cyan' },
  CANCELLED: { label: '已取消', color: 'default' },
};

// 付款方式映射
const paymentMethodMap: Record<string, string> = {
  TRANSFER: '银行转账',
  CASH: '现金',
  CHECK: '支票',
  DRAFT: '汇票',
  OTHER: '其他',
};

interface PaymentRequest {
  id: string;
  requestNo: string;
  projectId: string;
  reason: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  project?: { id: string; code: string; name: string };
  applicant: { id: string; name: string; email: string };
  bankAccount: { id: string; accountName: string; bankName: string };
  createdAt: string;
}

interface PageData {
  items: PaymentRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function PaymentRequestsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PageData | null>(null);
  const [filters, setFilters] = useState({
    requestNo: '',
    reason: '',
    status: '',
    page: 1,
    pageSize: 10,
  });

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.requestNo) params.append('requestNo', filters.requestNo);
      if (filters.reason) params.append('reason', filters.reason);
      if (filters.status) params.append('status', filters.status);
      params.append('page', String(filters.page));
      params.append('pageSize', String(filters.pageSize));

      const result = await api.get<PageData>(`/payment-requests?${params.toString()}`);
      setData(result);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.page, filters.pageSize]);

  // 搜索
  const handleSearch = () => {
    setFilters({ ...filters, page: 1 });
    loadData();
  };

  // 提交申请
  const handleSubmit = async (id: string) => {
    try {
      await api.post(`/payment-requests/${id}/submit`);
      message.success('提交成功');
      loadData();
    } catch (error: any) {
      message.error(error.message || '提交失败');
    }
  };

  // 取消申请
  const handleCancel = async (id: string) => {
    try {
      await api.post(`/payment-requests/${id}/cancel`);
      message.success('取消成功');
      loadData();
    } catch (error: any) {
      message.error(error.message || '取消失败');
    }
  };

  // 删除申请
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/payment-requests/${id}`);
      message.success('删除成功');
      loadData();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 表格列定义
  const columns: ColumnsType<PaymentRequest> = [
    {
      title: '申请单号',
      dataIndex: 'requestNo',
      key: 'requestNo',
      width: 160,
    },
    {
      title: '关联项目',
      key: 'project',
      width: 180,
      ellipsis: true,
      render: (_, record) =>
        record.project ? (
          <div>
            <div>{record.project.code}</div>
            <Text type="secondary" className="text-xs">
              {record.project.name}
            </Text>
          </div>
        ) : (
          '-'
        ),
    },
    {
      title: '付款事由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '付款金额',
      key: 'amount',
      width: 150,
      render: (_, record) => (
        <span>
          {record.currency} {Number(record.amount).toLocaleString()}
        </span>
      ),
    },
    {
      title: '付款方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (method) => paymentMethodMap[method] || method,
    },
    {
      title: '付款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (date) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: '申请人',
      key: 'applicant',
      width: 100,
      render: (_, record) => record.applicant?.name,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusMap[status]?.color}>{statusMap[status]?.label}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/payment-requests/${record.id}`)}
          />
          {record.status === 'DRAFT' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => router.push(`/payment-requests/${record.id}/edit`)}
              />
              <Button
                type="link"
                size="small"
                icon={<SendOutlined />}
                onClick={() => handleSubmit(record.id)}
              />
        <Popconfirm
          title="确定要删除该付款申请吗？"
          description="删除后数据将无法恢复"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
            </>
          )}
          {record.status === 'PENDING' && (
      <Popconfirm
        title="确定要取消该付款申请吗？"
        description="取消后需要重新提交审批"
        onConfirm={() => handleCancel(record.id)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="link" size="small" icon={<CloseOutlined />} />
      </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={4} style={{ margin: 0 }}>付款申请</Title>
          <Text type="secondary">现金、支票等各类（对公）付款申请</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/payment-requests/new')}
        >
          新建申请
        </Button>
      </div>

      {/* 搜索筛选 */}
      <Card size="small">
        <Space wrap>
          <Input
            placeholder="申请单号"
            value={filters.requestNo}
            onChange={(e) => setFilters({ ...filters, requestNo: e.target.value })}
            style={{ width: 160 }}
            allowClear
          />
          <Input
            placeholder="付款事由"
            value={filters.reason}
            onChange={(e) => setFilters({ ...filters, reason: e.target.value })}
            style={{ width: 160 }}
            allowClear
          />
          <Select
            placeholder="状态"
            value={filters.status || undefined}
            onChange={(value) => setFilters({ ...filters, status: value || '' })}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: 'DRAFT', label: '草稿' },
              { value: 'PENDING', label: '待审批' },
              { value: 'APPROVED', label: '已通过' },
              { value: 'REJECTED', label: '已拒绝' },
              { value: 'PAID', label: '已付款' },
            ]}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      </Card>

      {/* 数据表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={data?.items || []}
          rowKey="id"
          loading={loading}
          pagination={{
            current: filters.page,
            pageSize: filters.pageSize,
            total: data?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setFilters({ ...filters, page, pageSize });
            },
          }}
        />
      </Card>
    </div>
  );
}
