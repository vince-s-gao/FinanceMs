"use client";

// InfFinanceMs - 报表看板页面

import { useEffect, useState } from "react";
import {
  Row,
  Col,
  Card,
  Table,
  Statistic,
  Typography,
  Spin,
  message,
  Tabs,
  Button,
  Space,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  FileTextOutlined,
  WarningOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import apiClient, { api } from "@/lib/api";
import { formatAmount } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";

const { Title, Text } = Typography;

interface ReceivablesOverview {
  totalContractAmount: number;
  totalReceived: number;
  totalReceivable: number;
  agingDistribution: {
    normal: number;
    days0to30: number;
    days31to90: number;
    daysOver90: number;
  };
}

interface CustomerReportRow {
  customerId: string;
  customerName: string;
  contractCount: number;
  totalAmount: number;
  receivedAmount: number;
  receivableAmount: number;
  overdueOver90: number;
}

interface ProfitRow {
  contractId: string;
  contractNo: string;
  contractName: string;
  customerName: string;
  contractAmount: number;
  totalReceived: number;
  totalCost: number;
  profit: number;
  profitRate: number;
  isLoss: boolean;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("receivables");
  const [receivables, setReceivables] = useState<ReceivablesOverview | null>(
    null,
  );
  const [customerReport, setCustomerReport] = useState<CustomerReportRow[]>([]);
  const [profitAnalysis, setProfitAnalysis] = useState<ProfitRow[]>([]);

  // 加载数据
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [receivablesRes, customerRes, profitRes] = await Promise.all([
          api.get<ReceivablesOverview>("/reports/receivables"),
          api.get<CustomerReportRow[]>("/reports/customers"),
          api.get<ProfitRow[]>("/reports/contracts/profit"),
        ]);
        setReceivables(receivablesRes);
        setCustomerReport(customerRes);
        setProfitAnalysis(profitRes);
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载数据失败"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    );
  }

  // 客户报表列
  const customerColumns: TableColumnsType<CustomerReportRow> = [
    {
      title: "客户名称",
      dataIndex: "customerName",
      key: "customerName",
      ellipsis: true,
    },
    {
      title: "合同数",
      dataIndex: "contractCount",
      key: "contractCount",
      width: 80,
    },
    {
      title: "合同总额",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 130,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: "已收款",
      dataIndex: "receivedAmount",
      key: "receivedAmount",
      width: 130,
      render: (v: number) => <Text type="success">¥{formatAmount(v)}</Text>,
    },
    {
      title: "应收款",
      dataIndex: "receivableAmount",
      key: "receivableAmount",
      width: 130,
      render: (v: number) => (
        <Text type={v > 0 ? "warning" : "secondary"}>¥{formatAmount(v)}</Text>
      ),
    },
    {
      title: "90天+逾期",
      dataIndex: "overdueOver90",
      key: "overdueOver90",
      width: 130,
      render: (v: number) => (
        <Text type={v > 0 ? "danger" : "secondary"}>¥{formatAmount(v)}</Text>
      ),
    },
  ];

  const getExportEndpoint = (tab: string) => {
    if (tab === "customers") return "/reports/export/customers";
    if (tab === "profit") return "/reports/export/contracts/profit";
    return "/reports/export/receivables";
  };

  const getDefaultFilename = (tab: string) => {
    if (tab === "customers") return "customer-report.csv";
    if (tab === "profit") return "contract-profit.csv";
    return "receivables-overview.csv";
  };

  const parseFilename = (disposition?: string | null) => {
    if (!disposition) return undefined;
    const utf8Matched = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Matched?.[1]) return decodeURIComponent(utf8Matched[1]);
    const matched = disposition.match(/filename="?([^"]+)"?/i);
    return matched?.[1];
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await apiClient.get(getExportEndpoint(activeTab), {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename =
        parseFilename(response.headers?.["content-disposition"]) ||
        getDefaultFilename(activeTab);
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "导出失败"));
    } finally {
      setExporting(false);
    }
  };

  // 毛利分析列
  const profitColumns: TableColumnsType<ProfitRow> = [
    {
      title: "合同编号",
      dataIndex: "contractNo",
      key: "contractNo",
      width: 140,
    },
    {
      title: "合同名称",
      dataIndex: "contractName",
      key: "contractName",
      ellipsis: true,
    },
    {
      title: "客户",
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
      ellipsis: true,
    },
    {
      title: "合同金额",
      dataIndex: "contractAmount",
      key: "contractAmount",
      width: 120,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: "已回款",
      dataIndex: "totalReceived",
      key: "totalReceived",
      width: 120,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: "总成本",
      dataIndex: "totalCost",
      key: "totalCost",
      width: 120,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: "毛利",
      dataIndex: "profit",
      key: "profit",
      width: 120,
      render: (v: number, record: ProfitRow) => (
        <Text type={record.isLoss ? "danger" : "success"}>
          ¥{formatAmount(v)}
        </Text>
      ),
    },
    {
      title: "毛利率",
      dataIndex: "profitRate",
      key: "profitRate",
      width: 100,
      render: (v: number, record: ProfitRow) => (
        <Text type={record.isLoss ? "danger" : "success"}>{v}%</Text>
      ),
    },
  ];

  const tabItems = [
    {
      key: "receivables",
      label: "销售合同应收",
      children: (
        <div>
          {/* 汇总卡片 */}
          <Row gutter={[16, 16]} className="mb-6">
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="销售合同总额"
                  value={receivables?.totalContractAmount || 0}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="销售合同已回款"
                  value={receivables?.totalReceived || 0}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="销售合同应收余额"
                  value={receivables?.totalReceivable || 0}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: "#faad14" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="90天+逾期"
                  value={receivables?.agingDistribution?.daysOver90 || 0}
                  prefix="¥"
                  precision={2}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
          </Row>

          {/* 账龄分布 */}
          <Card title="账龄分布">
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} lg={6}>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Text type="secondary">正常</Text>
                  <div className="text-2xl font-bold text-green-500 mt-2">
                    ¥{formatAmount(receivables?.agingDistribution?.normal || 0)}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Text type="secondary">0-30天</Text>
                  <div className="text-2xl font-bold text-blue-500 mt-2">
                    ¥
                    {formatAmount(
                      receivables?.agingDistribution?.days0to30 || 0,
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <Text type="secondary">31-90天</Text>
                  <div className="text-2xl font-bold text-orange-500 mt-2">
                    ¥
                    {formatAmount(
                      receivables?.agingDistribution?.days31to90 || 0,
                    )}
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <Text type="secondary">90天以上</Text>
                  <div className="text-2xl font-bold text-red-500 mt-2">
                    ¥
                    {formatAmount(
                      receivables?.agingDistribution?.daysOver90 || 0,
                    )}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      ),
    },
    {
      key: "customers",
      label: "客户维度",
      children: (
        <Table
          columns={customerColumns}
          dataSource={customerReport}
          rowKey="customerId"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
        />
      ),
    },
    {
      key: "profit",
      label: "合同毛利",
      children: (
        <div>
          {/* 亏损预警 */}
          {profitAnalysis.some((c) => c.isLoss) && (
            <Card className="mb-4 bg-red-50 border-red-200">
              <div className="flex items-center">
                <WarningOutlined className="text-red-500 text-xl mr-2" />
                <Text type="danger">
                  存在 {profitAnalysis.filter((c) => c.isLoss).length}{" "}
                  个亏损合同，请关注！
                </Text>
              </div>
            </Card>
          )}

          <Table
            columns={profitColumns}
            dataSource={profitAnalysis}
            rowKey="contractId"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1000 }}
            rowClassName={(record: ProfitRow) =>
              record.isLoss ? "bg-red-50" : ""
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <Title level={4} className="!mb-0">
          📊 报表看板
        </Title>
        <Space>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={handleExport}
          >
            导出当前报表
          </Button>
        </Space>
      </div>

      <Tabs
        items={tabItems}
        className="mt-4"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key)}
      />
    </div>
  );
}
