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
      <Card className="card-hover">
        <Skeleton active paragraph={{ rows: 1 }} />
      </Card>
    );
  }
  
  return (
    <Card className="card-hover">
      <div className="flex items-start justify-between">
        <div>
          <Text type="secondary" className="text-sm">
            {title}
          </Text>
          <div className="mt-2">
            <Statistic
              value={value}
              prefix={prefix}
              suffix={suffix}
              valueStyle={{ color, fontSize: '24px', fontWeight: 600 }}
            />
          </div>
          {trend && (
            <div className="mt-2">
              <Text type={trend.isUp ? 'success' : 'danger'} className="text-xs">
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
  const { user } = useAuthStore();
  const [receivables, setReceivables] = useState<any>(null);
  const [contractDashboard, setContractDashboard] = useState<any>(null);
  const [expenseAnalysis, setExpenseAnalysis] = useState<any>(null);
  const [loadingMap, setLoadingMap] = useState({
    receivables: true,
    contracts: true,
    expenses: true,
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

    fetchReceivables();
    fetchContracts();
    fetchExpenses();
  }, [user]);

  // 员工视图
  if (user?.role === 'EMPLOYEE') {
    return (
      <div>
        <Title level={4}>👋 欢迎回来，{user.name}</Title>
        <Text type="secondary">您可以在左侧菜单中提交和查看报销申请</Text>

        <Row gutter={[16, 16]} className="mt-6">
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="待审批报销"
                value={0}
                suffix="笔"
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="已批准待打款"
                value={0}
                prefix="¥"
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="本月已报销"
                value={0}
                prefix="¥"
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    );
  }

  // 财务/管理层视图
  return (
    <div>
      <Title level={4}>📊 工作台</Title>

      {/* 核心指标 */}
      <Row gutter={[16, 16]} className="mt-4">
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
      </Row>

      {/* 第二行指标 */}
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingMap.contracts}>
            <Statistic
              title="执行中合同"
              value={contractDashboard?.executingCount || 0}
              suffix="个"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingMap.contracts}>
            <Statistic
              title="本月新签"
              value={contractDashboard?.monthlyNewCount || 0}
              suffix="个"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingMap.contracts}>
            <Statistic
              title="本月回款"
              value={formatAmount(contractDashboard?.monthlyPaymentAmount || 0)}
              prefix="¥"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loadingMap.expenses}>
            <Statistic
              title="待审批报销"
              value={expenseAnalysis?.pendingCount || 0}
              suffix="笔"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 即将到期回款 */}
      <Card title="⏰ 即将到期回款（7天内）" className="mt-4">
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

      {/* 账龄分布 */}
      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={12}>
          <Card title="📈 账龄分布">
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
        <Col xs={24} lg={12}>
          <Card title="💰 报销概况">
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
      </Row>
    </div>
  );
}
