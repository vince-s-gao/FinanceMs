'use client';

// InfFinanceMs - 工作台页面

import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Typography, Skeleton, message } from 'antd';
import {
  DollarOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  TeamOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { useAuthStore, isFinance, isManager } from '@/stores/auth';
import { formatAmount, formatDate } from '@/lib/constants';

const { Title, Text } = Typography;

// 统计卡片组件
function StatCard({
  title,
  value,
  prefix,
  suffix,
  icon,
  color,
  trend,
  loading,
}: {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  icon: React.ReactNode;
  color: string;
  trend?: { value: number; isUp: boolean };
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="card-hover tech-stat-card">
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }
  
  return (
    <Card className="card-hover tech-stat-card">
      <div className="flex items-start justify-between">
        <div>
          <Text className="text-sm !text-white/85">
            {title}
          </Text>
          <div className="mt-2">
            <Statistic
              value={value}
              prefix={prefix}
              suffix={suffix}
              valueStyle={{ color: '#ffffff', fontSize: '24px', fontWeight: 700 }}
            />
          </div>
          {trend && (
            <div className="mt-2">
              <Text className="text-xs !text-white/85">
                {trend.isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                {trend.value}% 较上月
              </Text>
            </div>
          )}
        </div>
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center text-xl"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  interface PaymentRequestStatistics {
    totalCount: number;
    draftCount: number;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    paidCount: number;
    totalAmount: number | string;
    paidAmount: number | string;
    payableAmount: number | string;
  }

  const { user } = useAuthStore();
  const currentDate = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const [receivables, setReceivables] = useState<any>(null);
  const [contractDashboard, setContractDashboard] = useState<any>(null);
  const [expenseAnalysis, setExpenseAnalysis] = useState<any>(null);
  const [paymentStats, setPaymentStats] = useState<PaymentRequestStatistics | null>(null);
  const [entityCounts, setEntityCounts] = useState({
    customerCount: 0,
    supplierCount: 0,
  });
  const [loadingMap, setLoadingMap] = useState({
    receivables: true,
    contracts: true,
    expenses: true,
    paymentRequests: true,
    entities: true,
  });

  // 加载数据 - 并行加载，不阻塞渲染
  useEffect(() => {
    // 只有财务和管理层可以看到完整数据
    if (!isFinance(user) && !isManager(user)) {
      return;
    }

    // 并行加载所有数据
    const fetchReceivables = async () => {
      try {
        const res = await api.get('/reports/receivables');
        setReceivables(res);
      } catch (error: any) {
        console.error('加载应收数据失败:', error);
      } finally {
        setLoadingMap(prev => ({ ...prev, receivables: false }));
      }
    };

    const fetchContracts = async () => {
      try {
        const res = await api.get('/reports/contracts/dashboard');
        setContractDashboard(res);
      } catch (error: any) {
        console.error('加载合同数据失败:', error);
      } finally {
        setLoadingMap(prev => ({ ...prev, contracts: false }));
      }
    };

    const fetchExpenses = async () => {
      try {
        const res = await api.get('/reports/expenses');
        setExpenseAnalysis(res);
      } catch (error: any) {
        console.error('加载报销数据失败:', error);
      } finally {
        setLoadingMap(prev => ({ ...prev, expenses: false }));
      }
    };

    const fetchPaymentRequests = async () => {
      try {
        const res = await api.get<PaymentRequestStatistics>('/payment-requests/statistics');
        setPaymentStats(res);
      } catch (error: any) {
        console.error('加载付款统计失败:', error);
      } finally {
        setLoadingMap(prev => ({ ...prev, paymentRequests: false }));
      }
    };

    const fetchEntityCounts = async () => {
      try {
        const [customerRes, supplierRes] = await Promise.all([
          api.get<{ total: number }>('/customers', { params: { page: 1, pageSize: 1 } }),
          api.get<{ total: number }>('/suppliers', { params: { page: 1, pageSize: 1 } }),
        ]);
        setEntityCounts({
          customerCount: customerRes?.total || 0,
          supplierCount: supplierRes?.total || 0,
        });
      } catch (error: any) {
        console.error('加载客户/供应商统计失败:', error);
      } finally {
        setLoadingMap(prev => ({ ...prev, entities: false }));
      }
    };

    fetchReceivables();
    fetchContracts();
    fetchExpenses();
    fetchPaymentRequests();
    fetchEntityCounts();
  }, [user]);

  // 员工视图
  if (user?.role === 'EMPLOYEE') {
    return (
      <div className="space-y-4">
        <div className="tech-dashboard-hero">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Text className="!text-[#9cc9ff]">EMPLOYEE PORTAL</Text>
              <Title level={4} className="!mb-1 !mt-2 !text-white">
                欢迎回来，{user.name}
              </Title>
              <Text className="!text-[#d8ecff]">今天是 {currentDate}，可在左侧菜单提交和追踪报销进度。</Text>
            </div>
          </div>
        </div>

        <Row gutter={[16, 16]} className="mt-6">
          <Col xs={24} sm={12} lg={8}>
            <Card className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">待审批报销</span>}
                value={0}
                suffix="笔"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">已批准待打款</span>}
                value={0}
                prefix="¥"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">本月已报销</span>}
                value={0}
                prefix="¥"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // 财务/管理层视图
  return (
    <div className="space-y-4">
      <div className="tech-dashboard-hero">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Text className="!text-[#9cc9ff]">FINANCE COMMAND CENTER</Text>
            <Title level={4} className="!mb-1 !mt-2 !text-white">
              数据总览工作台
            </Title>
            <Text className="!text-[#d8ecff]">
              实时监控合同、回款、报销与预算状态，关键风险将在此优先展示。
            </Text>
          </div>
          <Tag color="cyan" className="!m-0">
            {currentDate}
          </Tag>
        </div>
      </div>

      {/* 合同模块 */}
      <Card title="📁 合同模块" className="mt-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="合同总额"
              value={formatAmount(receivables?.totalContractAmount || 0)}
              prefix="¥"
              icon={<FileTextOutlined />}
              color="#1890ff"
              loading={loadingMap.receivables}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loadingMap.contracts} className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">执行中合同</span>}
                value={contractDashboard?.executingCount || 0}
                suffix="个"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loadingMap.contracts} className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">本月新签</span>}
                value={contractDashboard?.monthlyNewCount || 0}
                suffix="个"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="本月新签金额"
              value={formatAmount(contractDashboard?.monthlyNewAmount || 0)}
              prefix="¥"
              icon={<DollarOutlined />}
              color="#722ed1"
              loading={loadingMap.contracts}
            />
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="客户总数"
              value={entityCounts.customerCount}
              suffix="个"
              icon={<TeamOutlined />}
              color="#13c2c2"
              loading={loadingMap.entities}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="供应商总数"
              value={entityCounts.supplierCount}
              suffix="个"
              icon={<ShopOutlined />}
              color="#eb2f96"
              loading={loadingMap.entities}
            />
          </Col>
        </Row>
      </Card>

      {/* 收款模块 */}
      <Card title="💵 收款模块" className="mt-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="已回款"
              value={formatAmount(receivables?.totalReceived || 0)}
              prefix="¥"
              icon={<DollarOutlined />}
              color="#52c41a"
              loading={loadingMap.receivables}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="应收余额"
              value={formatAmount(receivables?.totalReceivable || 0)}
              prefix="¥"
              icon={<ClockCircleOutlined />}
              color="#faad14"
              loading={loadingMap.receivables}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="90天+逾期"
              value={formatAmount(receivables?.agingDistribution?.daysOver90 || 0)}
              prefix="¥"
              icon={<WarningOutlined />}
              color="#ff4d4f"
              loading={loadingMap.receivables}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loadingMap.contracts} className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">本月回款</span>}
                value={formatAmount(contractDashboard?.monthlyPaymentAmount || 0)}
                prefix="¥"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} lg={14}>
            <Card title="⏰ 即将到期回款（7天内）">
              {loadingMap.contracts ? (
                <Skeleton active paragraph={{ rows: 3 }} />
              ) : (
                <Table
                  dataSource={contractDashboard?.upcomingPayments || []}
                  rowKey="planId"
                  pagination={false}
                  size="small"
                  columns={[
                    {
                      title: '合同编号',
                      dataIndex: 'contractNo',
                      key: 'contractNo',
                    },
                    {
                      title: '合同名称',
                      dataIndex: 'contractName',
                      key: 'contractName',
                      ellipsis: true,
                    },
                    {
                      title: '期数',
                      dataIndex: 'period',
                      key: 'period',
                      render: (v: number) => `第${v}期`,
                    },
                    {
                      title: '计划金额',
                      dataIndex: 'planAmount',
                      key: 'planAmount',
                      render: (v: number) => `¥${formatAmount(v)}`,
                    },
                    {
                      title: '计划日期',
                      dataIndex: 'planDate',
                      key: 'planDate',
                      render: (v: string) => formatDate(v),
                    },
                    {
                      title: '剩余天数',
                      dataIndex: 'daysUntilDue',
                      key: 'daysUntilDue',
                      render: (v: number) => (
                        <Tag color={v <= 3 ? 'red' : 'orange'}>{v}天</Tag>
                      ),
                    },
                  ]}
                  locale={{ emptyText: '暂无即将到期的回款' }}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="📈 收款账龄分布">
              {loadingMap.receivables ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Text>正常</Text>
                    <Text strong className="text-green-500">
                      ¥{formatAmount(receivables?.agingDistribution?.normal || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>0-30天</Text>
                    <Text strong className="text-blue-500">
                      ¥{formatAmount(receivables?.agingDistribution?.days0to30 || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>31-90天</Text>
                    <Text strong className="text-orange-500">
                      ¥{formatAmount(receivables?.agingDistribution?.days31to90 || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>90天以上</Text>
                    <Text strong className="text-red-500">
                      ¥{formatAmount(receivables?.agingDistribution?.daysOver90 || 0)}
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* 付款模块 */}
      <Card title="💸 付款模块" className="mt-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="付款申请总额"
              value={formatAmount(Number(paymentStats?.totalAmount || 0))}
              prefix="¥"
              icon={<DollarOutlined />}
              color="#13c2c2"
              loading={loadingMap.paymentRequests}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="应付款金额"
              value={formatAmount(Number(paymentStats?.payableAmount || 0))}
              prefix="¥"
              icon={<ClockCircleOutlined />}
              color="#fa8c16"
              loading={loadingMap.paymentRequests}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="已付款金额"
              value={formatAmount(Number(paymentStats?.paidAmount || 0))}
              prefix="¥"
              icon={<DollarOutlined />}
              color="#52c41a"
              loading={loadingMap.paymentRequests}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card loading={loadingMap.paymentRequests} className="tech-stat-card">
              <Statistic
                title={<span className="text-white/85">待付款申请</span>}
                value={(paymentStats?.pendingCount || 0) + (paymentStats?.approvedCount || 0)}
                suffix="笔"
                valueStyle={{ color: '#ffffff' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-4">
          <Col xs={24} lg={12}>
            <Card title="🧾 报销打款概况">
              {loadingMap.expenses ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Text>本月报销总额</Text>
                    <Text strong>¥{formatAmount(expenseAnalysis?.monthlyTotal || 0)}</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>待审批</Text>
                    <Text strong className="text-blue-500">
                      {expenseAnalysis?.pendingCount || 0}笔 / ¥
                      {formatAmount(expenseAnalysis?.pendingAmount || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>待打款</Text>
                    <Text strong className="text-green-500">
                      {expenseAnalysis?.unpaidCount || 0}笔 / ¥
                      {formatAmount(expenseAnalysis?.unpaidAmount || 0)}
                    </Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>无票金额占比</Text>
                    <Text strong className="text-orange-500">
                      {expenseAnalysis?.noInvoiceRatio || 0}%
                    </Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="📌 付款申请状态分布">
              {loadingMap.paymentRequests ? (
                <Skeleton active paragraph={{ rows: 4 }} />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Text>草稿</Text>
                    <Text strong>{paymentStats?.draftCount || 0} 笔</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>待审批</Text>
                    <Text strong className="text-orange-500">{paymentStats?.pendingCount || 0} 笔</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>已通过待付</Text>
                    <Text strong className="text-blue-500">{paymentStats?.approvedCount || 0} 笔</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>已付款</Text>
                    <Text strong className="text-green-500">{paymentStats?.paidCount || 0} 笔</Text>
                  </div>
                  <div className="flex justify-between items-center">
                    <Text>已驳回</Text>
                    <Text strong className="text-red-500">{paymentStats?.rejectedCount || 0} 笔</Text>
                  </div>
                </div>
              )}
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
