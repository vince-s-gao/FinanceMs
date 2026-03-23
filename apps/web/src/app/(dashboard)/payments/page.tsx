"use client";

// InfFinanceMs - 回款管理页面

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  Tag,
  Progress,
  Space,
  Button,
  Spin,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import { formatAmount, formatDate } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import { formatLocaleMoney } from "@/lib/number";

const { Title, Text } = Typography;

interface PaymentStatistics {
  summary: {
    totalContractAmount: number;
    totalPaidAmount: number;
    totalReceivable: number;
    overdueAmount: number;
    contractCount: number;
    completionRate: number;
  };
  contracts: ContractPaymentInfo[];
}

interface ContractPaymentInfo {
  id: string;
  contractNo: string;
  name: string;
  customer: {
    id: string;
    name: string;
    code: string;
  };
  amountWithTax: number;
  totalPaid: number;
  receivable: number;
  overdueAmount: number;
  progress: number;
  signDate: string;
  status: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState<PaymentStatistics | null>(null);

  // 加载回款统计数据
  const fetchStatistics = async () => {
    setLoading(true);
    try {
      const res = await api.get<PaymentStatistics>("/payments/statistics");
      setStatistics(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载失败"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatistics();
  }, []);

  // 表格列定义
  const columns: TableColumnsType<ContractPaymentInfo> = [
    {
      title: "合同编号",
      dataIndex: "contractNo",
      key: "contractNo",
      width: 140,
      render: (v: string, record: ContractPaymentInfo) => (
        <a onClick={() => router.push(`/contracts/${record.id}`)}>{v}</a>
      ),
    },
    {
      title: "合同名称",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
    },
    {
      title: "客户",
      dataIndex: ["customer", "name"],
      key: "customer",
      width: 150,
      ellipsis: true,
    },
    {
      title: "合同金额",
      dataIndex: "amountWithTax",
      key: "amountWithTax",
      width: 130,
      render: (v: number) => <Text>¥{formatAmount(v)}</Text>,
    },
    {
      title: "已回款",
      dataIndex: "totalPaid",
      key: "totalPaid",
      width: 130,
      render: (v: number) => <Text type="success">¥{formatAmount(v)}</Text>,
    },
    {
      title: "应收余额",
      dataIndex: "receivable",
      key: "receivable",
      width: 130,
      render: (v: number) => (
        <Text type={Number(v) > 0 ? "warning" : "success"}>
          ¥{formatAmount(v)}
        </Text>
      ),
    },
    {
      title: "逾期金额",
      dataIndex: "overdueAmount",
      key: "overdueAmount",
      width: 120,
      render: (v: number) =>
        Number(v) > 0 ? (
          <Text type="danger">¥{formatAmount(v)}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "回款进度",
      dataIndex: "progress",
      key: "progress",
      width: 150,
      render: (progress: number) => (
        <Progress
          percent={progress}
          size="small"
          status={
            progress >= 100 ? "success" : progress > 0 ? "active" : "normal"
          }
        />
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      render: (_: unknown, record: ContractPaymentInfo) => (
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  const summary = statistics?.summary;

  return (
    <div>
      <Title level={4}>回款管理</Title>

      {/* 统计卡片 */}
      <Row gutter={16} className="mb-4">
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="合同总金额"
              value={summary?.totalContractAmount || 0}
              precision={2}
              prefix={<DollarOutlined />}
              suffix="元"
              valueStyle={{ color: "#1890ff" }}
              formatter={(value) => formatLocaleMoney(value)}
            />
            <div className="mt-2">
              <Text type="secondary">
                执行中销售合同 {summary?.contractCount || 0} 个
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已回款金额"
              value={summary?.totalPaidAmount || 0}
              precision={2}
              prefix={<CheckCircleOutlined />}
              suffix="元"
              valueStyle={{ color: "#52c41a" }}
              formatter={(value) => formatLocaleMoney(value)}
            />
            <div className="mt-2">
              <Text type="secondary">
                回款率 {summary?.completionRate || 0}%
              </Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="应收余额"
              value={summary?.totalReceivable || 0}
              precision={2}
              prefix={<ClockCircleOutlined />}
              suffix="元"
              formatter={(value) => formatLocaleMoney(value)}
              valueStyle={{ color: "#faad14" }}
            />
            <div className="mt-2">
              <Text type="secondary">待回款金额</Text>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="逾期金额"
              value={summary?.overdueAmount || 0}
              precision={2}
              prefix={<WarningOutlined />}
              suffix="元"
              valueStyle={{ color: "#ff4d4f" }}
              formatter={(value) => formatLocaleMoney(value)}
            />
            <div className="mt-2">
              <Text type="secondary">需及时跟进</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 回款进度总览 */}
      <Card className="mb-4">
        <div className="flex items-center gap-4">
          <Text strong>整体回款进度：</Text>
          <div className="flex-1">
            <Progress
              percent={summary?.completionRate || 0}
              status={
                (summary?.completionRate || 0) >= 100
                  ? "success"
                  : (summary?.completionRate || 0) > 50
                    ? "active"
                    : "normal"
              }
              strokeWidth={16}
              format={(percent) => `${percent}%`}
            />
          </div>
        </div>
      </Card>

      {/* 合同回款列表 */}
      <Card title="销售合同回款状态">
        <Table
          columns={columns}
          dataSource={statistics?.contracts || []}
          rowKey="id"
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
}
