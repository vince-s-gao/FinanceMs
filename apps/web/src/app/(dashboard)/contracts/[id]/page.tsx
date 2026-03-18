'use client';

// InfFinanceMs - 合同详情页面

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Typography,
  Table,
  Spin,
  message,
  Progress,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  formatAmount,
  formatDate,
} from '@/lib/constants';

const { Title, Text } = Typography;

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  signingEntity?: string | null;
  contractType?: string | null;
  customer: {
    id: string;
    name: string;
    code: string;
  };
  amountWithTax: number;
  amountWithoutTax: number;
  taxRate: number;
  status: string;
  signDate: string;
  startDate?: string;
  endDate?: string;
  remark?: string;
  totalPaid: number;
  receivable: number;
  paymentPlans: PaymentPlan[];
  paymentRecords: PaymentRecord[];
}

interface PaymentPlan {
  id: string;
  period: number;
  planAmount: number;
  planDate: string;
  status: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  remark?: string;
}

interface DictionaryItem {
  id: string;
  code: string;
  name: string;
}

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<Contract | null>(null);
  const [contractTypeMap, setContractTypeMap] = useState<Record<string, string>>({});

  const contractId = params.id as string;

  // 加载合同详情
  const fetchContract = async () => {
    setLoading(true);
    try {
      const res = await api.get<Contract>(`/contracts/${contractId}`);
      setContract(res);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchContractTypes = async () => {
    try {
      const types = await api.get<DictionaryItem[]>('/dictionaries/by-type/CONTRACT_TYPE');
      const map = types.reduce<Record<string, string>>((acc, item) => {
        acc[item.code] = item.name;
        return acc;
      }, {});
      setContractTypeMap(map);
    } catch {
      setContractTypeMap({
        SALES: '销售合同',
        PURCHASE: '采购合同',
        SERVICE: '服务合同',
        OTHER: '其他',
      });
    }
  };

  useEffect(() => {
    fetchContractTypes();
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  // 计算回款进度
  const getPaymentProgress = () => {
    if (!contract) return 0;
    const amount = Number(contract.amountWithTax);
    const paid = Number(contract.totalPaid);
    if (amount === 0) return 0;
    return Math.round((paid / amount) * 100);
  };

  // 回款计划表格列
  const planColumns = [
    {
      title: '期数',
      dataIndex: 'period',
      key: 'period',
      width: 80,
      render: (v: number) => `第${v}期`,
    },
    {
      title: '计划金额',
      dataIndex: 'planAmount',
      key: 'planAmount',
      width: 150,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: '计划日期',
      dataIndex: 'planDate',
      key: 'planDate',
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          PENDING: { label: '待回款', color: 'default' },
          PARTIAL: { label: '部分回款', color: 'processing' },
          COMPLETED: { label: '已完成', color: 'success' },
        };
        const info = statusMap[status] || { label: status, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
  ];

  // 回款记录表格列
  const recordColumns = [
    {
      title: '回款金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      render: (v: number) => <Text strong>¥{formatAmount(v)}</Text>,
    },
    {
      title: '回款日期',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: '回款方式',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 100,
      render: (v: string) => {
        const methodMap: Record<string, string> = {
          TRANSFER: '转账',
          CASH: '现金',
          CHECK: '支票',
        };
        return methodMap[v] || v || '-';
      },
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="text-center py-20">
        <Text type="secondary">合同不存在或已被删除</Text>
        <div className="mt-4">
          <Button onClick={() => router.push('/contracts')}>返回列表</Button>
        </div>
      </div>
    );
  }

  const progress = getPaymentProgress();

  return (
    <div>
      {/* 页面头部 */}
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/contracts')}
          >
            返回
          </Button>
          <Title level={4} className="!mb-0">
            合同详情
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<EditOutlined />}
          onClick={() => router.push(`/contracts/${contractId}/edit`)}
        >
          编辑
        </Button>
      </div>

      {/* 基本信息 */}
      <Card title="基本信息" className="mb-4">
        <Descriptions column={{ xs: 1, sm: 2, md: 3 }}>
          <Descriptions.Item label="合同编号">
            <Text strong>{contract.contractNo}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="合同名称">
            {contract.name}
          </Descriptions.Item>
          <Descriptions.Item label="客户">
            {contract.customer?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="签约年份">
            {contract.signDate ? new Date(contract.signDate).getFullYear() : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="公司签约主体">
            {contract.signingEntity || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="合同类型">
            {contract.contractType ? contractTypeMap[contract.contractType] || contract.contractType : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="合同状态">
            <Tag color={CONTRACT_STATUS_COLORS[contract.status]}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="签订日期">
            {formatDate(contract.signDate)}
          </Descriptions.Item>
          <Descriptions.Item label="合同期限">
            {contract.startDate && contract.endDate
              ? `${formatDate(contract.startDate)} ~ ${formatDate(contract.endDate)}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="含税金额">
            <Text strong type="success">¥{formatAmount(contract.amountWithTax)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="不含税金额">
            ¥{formatAmount(contract.amountWithoutTax)}
          </Descriptions.Item>
          <Descriptions.Item label="税率">
            {contract.taxRate ? `${contract.taxRate}%` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {contract.remark || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 回款概览 */}
      <Card title="回款概览" className="mb-4">
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <div className="mb-2">
              <Text type="secondary">回款进度</Text>
            </div>
            <Progress
              percent={progress}
              status={progress >= 100 ? 'success' : 'active'}
              strokeWidth={12}
            />
          </div>
          <Divider type="vertical" style={{ height: 60 }} />
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ¥{formatAmount(contract.totalPaid)}
            </div>
            <Text type="secondary">已回款</Text>
          </div>
          <Divider type="vertical" style={{ height: 60 }} />
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              ¥{formatAmount(contract.receivable)}
            </div>
            <Text type="secondary">应收余额</Text>
          </div>
        </div>
      </Card>

      {/* 回款计划 */}
      <Card title="回款计划" className="mb-4">
        <Table
          columns={planColumns}
          dataSource={contract.paymentPlans || []}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无回款计划' }}
        />
      </Card>

      {/* 回款记录 */}
      <Card title="回款记录">
        <Table
          columns={recordColumns}
          dataSource={contract.paymentRecords || []}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无回款记录' }}
        />
      </Card>
    </div>
  );
}
