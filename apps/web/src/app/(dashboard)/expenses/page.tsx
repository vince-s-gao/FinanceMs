'use client';

// InfFinanceMs - 报销管理页面

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore, isFinance } from '@/stores/auth';
import {
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_COLORS,
  formatAmount,
  formatDate,
} from '@/lib/constants';

const { Title, Text } = Typography;
const { Option } = Select;

interface Expense {
  id: string;
  expenseNo: string;
  applicant: {
    id: string;
    name: string;
    department: string;
  };
  project?: {
    id: string;
    code: string;
    name: string;
  };
  totalAmount: number;
  status: string;
  createdAt: string;
  submitDate?: string;
  _count?: {
    details: number;
  };
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 加载报销列表
  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<any>('/expenses', { params });
      setExpenses(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [page, pageSize, keyword, statusFilter]);

  // 提交报销
  const handleSubmit = async (id: string) => {
    try {
      await api.patch(`/expenses/${id}/submit`);
      message.success('提交成功');
      fetchExpenses();
    } catch (error: any) {
      message.error(error.message || '提交失败');
    }
  };

  // 审批报销
  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/expenses/${id}/approve`, {
        approved,
        rejectReason: approved ? undefined : '审批驳回',
      });
      message.success(approved ? '审批通过' : '已驳回');
      fetchExpenses();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 打款
  const handlePay = async (id: string) => {
    try {
      await api.patch(`/expenses/${id}/pay`);
      message.success('打款成功');
      fetchExpenses();
    } catch (error: any) {
      message.error(error.message || '打款失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '报销单号',
      dataIndex: 'expenseNo',
      key: 'expenseNo',
      width: 140,
      render: (v: string, record: Expense) => (
        <a onClick={() => router.push(`/expenses/${record.id}`)}>{v}</a>
      ),
    },
    {
      title: '申请人',
      dataIndex: ['applicant', 'name'],
      key: 'applicant',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: ['applicant', 'department'],
      key: 'department',
      width: 100,
    },
    {
      title: '明细数',
      dataIndex: ['_count', 'details'],
      key: 'detailCount',
      width: 90,
      render: (v: number | undefined) => v ?? 0,
    },
    {
      title: '关联项目',
      dataIndex: ['project', 'name'],
      key: 'project',
      width: 150,
      render: (v: string, record: Expense) => (
        record.project ? (
          <span title={record.project.code}>{v}</span>
        ) : '-'
      ),
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      render: (v: number) => (
        <Text strong>¥{formatAmount(v)}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={EXPENSE_STATUS_COLORS[status]}>
          {EXPENSE_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '提交时间',
      dataIndex: 'submitDate',
      key: 'submitDate',
      width: 110,
      render: (v: string) => (v ? formatDate(v) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Expense) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/expenses/${record.id}`)}
          >
            详情
          </Button>

          {/* 草稿/驳回状态可提交 */}
          {['DRAFT', 'REJECTED'].includes(record.status) &&
            record.applicant.id === user?.id && (
              <Popconfirm
                title="确定提交该报销单吗？"
                onConfirm={() => handleSubmit(record.id)}
              >
                <Button type="link" size="small" icon={<SendOutlined />}>
                  提交
                </Button>
              </Popconfirm>
            )}

          {/* 财务可审批 */}
          {record.status === 'PENDING' && isFinance(user) && (
            <>
              <Popconfirm
                title="确定通过该报销单吗？"
                onConfirm={() => handleApprove(record.id, true)}
              >
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  style={{ color: '#52c41a' }}
                >
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定驳回该报销单吗？"
                onConfirm={() => handleApprove(record.id, false)}
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                >
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}

          {/* 财务可打款 */}
          {record.status === 'APPROVED' && isFinance(user) && (
            <Popconfirm
              title="确定已完成打款吗？"
              onConfirm={() => handlePay(record.id)}
            >
              <Button
                type="link"
                size="small"
                icon={<DollarOutlined />}
                style={{ color: '#52c41a' }}
              >
                打款
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          报销管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/expenses/new')}
        >
          新增报销
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索报销单号/申请人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="报销状态"
            value={statusFilter}
            onChange={(value) => {
              setPage(1);
              setStatusFilter(value);
            }}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="DRAFT">草稿</Option>
            <Option value="PENDING">审批中</Option>
            <Option value="APPROVED">已批准</Option>
            <Option value="REJECTED">已驳回</Option>
            <Option value="PAID">已打款</Option>
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={expenses}
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
    </div>
  );
}
