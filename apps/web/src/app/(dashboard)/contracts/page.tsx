'use client';

// InfFinanceMs - 合同管理页面

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
  Progress,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, formatAmount, formatDate } from '@/lib/constants';

const { Title, Text } = Typography;
const { Option } = Select;

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  customer: {
    id: string;
    name: string;
    code: string;
  };
  amountWithTax: number;
  status: string;
  signDate: string;
  totalPaid: number;
  receivable: number;
}

export default function ContractsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  // 加载合同列表
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<any>('/contracts', { params });
      setContracts(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [page, pageSize, keyword, statusFilter]);

  // 计算回款进度
  const getPaymentProgress = (contract: Contract) => {
    const amount = Number(contract.amountWithTax);
    const paid = Number(contract.totalPaid);
    if (amount === 0) return 0;
    return Math.round((paid / amount) * 100);
  };

  // 表格列定义
  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contractNo',
      key: 'contractNo',
      width: 140,
      render: (v: string, record: Contract) => (
        <a onClick={() => router.push(`/contracts/${record.id}`)}>{v}</a>
      ),
    },
    {
      title: '合同名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '客户',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      width: 150,
      ellipsis: true,
    },
    {
      title: '合同金额',
      dataIndex: 'amountWithTax',
      key: 'amountWithTax',
      width: 130,
      render: (v: number) => (
        <Text strong>¥{formatAmount(v)}</Text>
      ),
    },
    {
      title: '回款进度',
      key: 'progress',
      width: 150,
      render: (_: any, record: Contract) => {
        const progress = getPaymentProgress(record);
        return (
          <Tooltip title={`已回款: ¥${formatAmount(record.totalPaid)}`}>
            <Progress
              percent={progress}
              size="small"
              status={progress >= 100 ? 'success' : 'active'}
            />
          </Tooltip>
        );
      },
    },
    {
      title: '应收余额',
      dataIndex: 'receivable',
      key: 'receivable',
      width: 120,
      render: (v: number) => (
        <Text type={Number(v) > 0 ? 'warning' : 'success'}>
          ¥{formatAmount(v)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={CONTRACT_STATUS_COLORS[status]}>
          {CONTRACT_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '签订日期',
      dataIndex: 'signDate',
      key: 'signDate',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Contract) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => router.push(`/contracts/${record.id}`)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          合同管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => router.push('/contracts/new')}
        >
          新增合同
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索合同编号/名称/客户"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="合同状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="DRAFT">草稿</Option>
            <Option value="EXECUTING">执行中</Option>
            <Option value="COMPLETED">已完成</Option>
            <Option value="TERMINATED">已终止</Option>
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={contracts}
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
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
