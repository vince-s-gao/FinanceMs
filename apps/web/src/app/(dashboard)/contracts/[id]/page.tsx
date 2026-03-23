"use client";

// InfFinanceMs - 合同详情页面

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DownloadOutlined,
  PaperClipOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  formatAmount,
  formatDate,
} from "@/lib/constants";

const { Title, Text } = Typography;

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  signingEntity?: string | null;
  contractType?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
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
  invoices: InvoiceRecord[];
  summary?: {
    totalPaid?: number | string;
    receivable?: number | string;
    totalInvoiced?: number | string;
    uninvoiced?: number | string;
    paymentProgress?: number | string;
  };
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

interface InvoiceRecord {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number | null;
  invoiceDate: string;
  status: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
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
  const [contractTypeMap, setContractTypeMap] = useState<
    Record<string, string>
  >({});

  const contractId = params.id as string;

  const resolveAttachmentDownloadUrl = (id: string) => {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      try {
        const parsed = new URL(configured);
        const basePath = parsed.pathname.replace(/\/$/, "");
        const apiPath = basePath.endsWith("/api")
          ? basePath
          : `${basePath}/api`;
        return `${parsed.protocol}//${parsed.host}${apiPath}/contracts/${id}/attachment/download`;
      } catch {
        // ignore invalid configured url
      }
    }
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:3001/api/contracts/${id}/attachment/download`;
    }
    return `http://127.0.0.1:3001/api/contracts/${id}/attachment/download`;
  };

  const resolveAttachmentPreviewUrl = (id: string) => {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      try {
        const parsed = new URL(configured);
        const basePath = parsed.pathname.replace(/\/$/, "");
        const apiPath = basePath.endsWith("/api")
          ? basePath
          : `${basePath}/api`;
        return `${parsed.protocol}//${parsed.host}${apiPath}/contracts/${id}/attachment/preview`;
      } catch {
        // ignore invalid configured url
      }
    }
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:3001/api/contracts/${id}/attachment/preview`;
    }
    return `http://127.0.0.1:3001/api/contracts/${id}/attachment/preview`;
  };

  const resolveInvoiceAttachmentUrl = (url?: string | null) => {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;
    const normalizedPath = url.startsWith("/") ? url : `/${url}`;

    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      try {
        const parsed = new URL(configured);
        return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
      } catch {
        // ignore invalid configured url
      }
    }

    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:3001${normalizedPath}`;
    }
    return `http://127.0.0.1:3001${normalizedPath}`;
  };

  const resolveInvoiceAttachmentDownloadUrl = (id: string) => {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      try {
        const parsed = new URL(configured);
        const basePath = parsed.pathname.replace(/\/$/, "");
        const apiPath = basePath.endsWith("/api")
          ? basePath
          : `${basePath}/api`;
        return `${parsed.protocol}//${parsed.host}${apiPath}/invoices/${id}/attachment/download`;
      } catch {
        // ignore invalid configured url
      }
    }
    if (typeof window !== "undefined") {
      return `${window.location.protocol}//${window.location.hostname}:3001/api/invoices/${id}/attachment/download`;
    }
    return `http://127.0.0.1:3001/api/invoices/${id}/attachment/download`;
  };

  const resolveContractFlow = (contractTypeCode?: string | null) => {
    const displayType = contractTypeCode
      ? contractTypeMap[contractTypeCode] || contractTypeCode
      : "";
    const normalized = String(displayType).toLowerCase();
    const isPurchase = /采购|purchase|procurement|buy|应付|付款/.test(
      normalized,
    );
    const isSales = /销售|sale|sales|应收|回款/.test(normalized);
    if (isPurchase && !isSales) {
      return {
        overviewTitle: "付款概览",
        progressLabel: "付款进度",
        doneLabel: "已付款",
        balanceLabel: "应付余额",
        planTitle: "付款计划",
        recordTitle: "付款记录",
        planStatusPending: "待付款",
        planStatusPartial: "部分付款",
        amountColumn: "付款金额",
        dateColumn: "付款日期",
        methodColumn: "付款方式",
      };
    }
    return {
      overviewTitle: "回款概览",
      progressLabel: "回款进度",
      doneLabel: "已回款",
      balanceLabel: "应收余额",
      planTitle: "回款计划",
      recordTitle: "回款记录",
      planStatusPending: "待回款",
      planStatusPartial: "部分回款",
      amountColumn: "回款金额",
      dateColumn: "回款日期",
      methodColumn: "回款方式",
    };
  };

  const isNoPaymentContractType = (contractTypeCode?: string | null) => {
    if (!contractTypeCode) return false;
    const displayType = contractTypeMap[contractTypeCode] || contractTypeCode;
    const normalized = String(displayType).toLowerCase().trim();
    const compact = normalized.replace(/\s+/g, "");
    const noPaymentTypes = new Set(["nda", "other", "ts", "fa", "其他"]);
    return noPaymentTypes.has(compact) || compact.includes("保密");
  };

  const isPdfAttachment = (name?: string | null, url?: string | null) => {
    const source = `${name || ""} ${url || ""}`.toLowerCase();
    return source.includes(".pdf");
  };

  // 加载合同详情
  const fetchContract = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<Contract>(`/contracts/${contractId}`);
      setContract(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载失败"));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  const fetchContractTypes = useCallback(async () => {
    try {
      const types = await api.get<DictionaryItem[]>(
        "/dictionaries/by-type/CONTRACT_TYPE",
      );
      const map = types.reduce<Record<string, string>>((acc, item) => {
        acc[item.code] = item.name;
        return acc;
      }, {});
      setContractTypeMap(map);
    } catch {
      setContractTypeMap({
        SALES: "销售合同",
        PURCHASE: "采购合同",
        SERVICE: "服务合同",
        OTHER: "其他",
      });
    }
  }, []);

  useEffect(() => {
    fetchContractTypes();
    if (contractId) {
      fetchContract();
    }
  }, [contractId, fetchContract, fetchContractTypes]);

  // 计算回款进度
  const toNumber = (value: number | string | null | undefined) => {
    if (value === null || value === undefined) return 0;
    const n = typeof value === "string" ? Number(value) : value;
    return Number.isFinite(n) ? n : 0;
  };

  const getTotalPaid = () => {
    if (!contract) return 0;
    const fromSummary = toNumber(contract.summary?.totalPaid);
    if (fromSummary > 0) return fromSummary;
    return (contract.paymentRecords || []).reduce(
      (sum, item) => sum + toNumber(item.amount),
      0,
    );
  };

  const getReceivable = () => {
    if (!contract) return 0;
    const fromSummary = toNumber(contract.summary?.receivable);
    if (contract.summary?.receivable !== undefined) return fromSummary;
    return toNumber(contract.amountWithTax) - getTotalPaid();
  };

  const getTotalInvoiced = () => {
    if (!contract) return 0;
    const fromSummary = toNumber(contract.summary?.totalInvoiced);
    if (contract.summary?.totalInvoiced !== undefined) return fromSummary;
    return (contract.invoices || [])
      .filter((item) => item.status === "ISSUED")
      .reduce((sum, item) => sum + toNumber(item.amount), 0);
  };

  const getUninvoiced = () => {
    if (!contract) return 0;
    const fromSummary = toNumber(contract.summary?.uninvoiced);
    if (contract.summary?.uninvoiced !== undefined) return fromSummary;
    return toNumber(contract.amountWithTax) - getTotalInvoiced();
  };

  const getPaymentProgress = () => {
    if (!contract) return 0;
    const amount = Number(contract.amountWithTax);
    const paid = getTotalPaid();
    if (amount === 0) return 0;
    return Math.round((paid / amount) * 100);
  };

  const getInvoiceProgress = () => {
    if (!contract) return 0;
    const totalAmount = toNumber(contract.amountWithTax);
    const invoiced = getTotalInvoiced();
    if (totalAmount <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, Math.round((invoiced / totalAmount) * 100)),
    );
  };

  // 回款计划表格列
  const planColumns = [
    {
      title: "期数",
      dataIndex: "period",
      key: "period",
      width: 80,
      render: (v: number) => `第${v}期`,
    },
    {
      title: "计划金额",
      dataIndex: "planAmount",
      key: "planAmount",
      width: 150,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: "计划日期",
      dataIndex: "planDate",
      key: "planDate",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const statusMap: Record<string, { label: string; color: string }> = {
          PENDING: { label: "待回款", color: "default" },
          PARTIAL: { label: "部分回款", color: "processing" },
          COMPLETED: { label: "已完成", color: "success" },
        };
        const info = statusMap[status] || { label: status, color: "default" };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
  ];

  // 回款记录表格列
  const recordColumns = [
    {
      title: "回款金额",
      dataIndex: "amount",
      key: "amount",
      width: 150,
      render: (v: number) => <Text strong>¥{formatAmount(v)}</Text>,
    },
    {
      title: "回款日期",
      dataIndex: "paymentDate",
      key: "paymentDate",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: "回款方式",
      dataIndex: "paymentMethod",
      key: "paymentMethod",
      width: 100,
      render: (v: string) => {
        const methodMap: Record<string, string> = {
          TRANSFER: "转账",
          CASH: "现金",
          CHECK: "支票",
        };
        return methodMap[v] || v || "-";
      },
    },
    {
      title: "备注",
      dataIndex: "remark",
      key: "remark",
      ellipsis: true,
      render: (v: string) => v || "-",
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
          <Button onClick={() => router.push("/contracts")}>返回列表</Button>
        </div>
      </div>
    );
  }

  const progress = getPaymentProgress();
  const invoiceProgress = getInvoiceProgress();
  const totalPaid = getTotalPaid();
  const receivable = getReceivable();
  const totalInvoiced = getTotalInvoiced();
  const uninvoiced = getUninvoiced();
  const flowLabels = resolveContractFlow(contract.contractType);
  const hidePaymentSection = isNoPaymentContractType(contract.contractType);

  const invoiceColumns = [
    {
      title: "发票号码",
      dataIndex: "invoiceNo",
      key: "invoiceNo",
      width: 180,
      ellipsis: true,
    },
    {
      title: "发票类型",
      dataIndex: "invoiceType",
      key: "invoiceType",
      width: 150,
      render: (v: string) => INVOICE_TYPE_LABELS[v] || v || "-",
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      width: 140,
      render: (v: number) => <Text strong>¥{formatAmount(v)}</Text>,
    },
    {
      title: "税额",
      dataIndex: "taxAmount",
      key: "taxAmount",
      width: 140,
      render: (v?: number | null) =>
        v === null || v === undefined ? "-" : `¥${formatAmount(v)}`,
    },
    {
      title: "开票日期",
      dataIndex: "invoiceDate",
      key: "invoiceDate",
      width: 130,
      render: (v: string) => formatDate(v),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (v: string) => (
        <Tag color={INVOICE_STATUS_COLORS[v] || "default"}>
          {INVOICE_STATUS_LABELS[v] || v || "-"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 170,
      render: (_: unknown, record: InvoiceRecord) =>
        record.attachmentUrl ? (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              href={resolveInvoiceAttachmentUrl(record.attachmentUrl)}
              target="_blank"
              rel="noreferrer"
            >
              预览
            </Button>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              href={resolveInvoiceAttachmentDownloadUrl(record.id)}
              target="_blank"
              rel="noreferrer"
            >
              下载
            </Button>
          </Space>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <div>
      {/* 页面头部 */}
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push("/contracts")}
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
          <Descriptions.Item label="对方签约主体">
            {contract.customer?.name || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="签约年份">
            {contract.signDate
              ? new Date(contract.signDate).getFullYear()
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="公司签约主体">
            {contract.signingEntity || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="合同类型">
            {contract.contractType
              ? contractTypeMap[contract.contractType] || contract.contractType
              : "-"}
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
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="含税金额">
            <Text strong type="success">
              ¥{formatAmount(contract.amountWithTax)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="不含税金额">
            ¥{formatAmount(contract.amountWithoutTax)}
          </Descriptions.Item>
          <Descriptions.Item label="税率">
            {contract.taxRate ? `${contract.taxRate}%` : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={3}>
            {contract.remark || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="合同附件" span={3}>
            {contract.attachmentUrl ? (
              <Space wrap>
                <Tag icon={<PaperClipOutlined />} color="blue">
                  {contract.attachmentName || "合同附件"}
                </Tag>
                {isPdfAttachment(
                  contract.attachmentName,
                  contract.attachmentUrl,
                ) && (
                  <Button
                    type="link"
                    icon={<EyeOutlined />}
                    href={resolveAttachmentPreviewUrl(contract.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    预览PDF
                  </Button>
                )}
                <Button
                  type="link"
                  icon={<DownloadOutlined />}
                  href={resolveAttachmentDownloadUrl(contract.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  下载附件
                </Button>
              </Space>
            ) : (
              "-"
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {!hidePaymentSection && (
        <>
          {/* 回款概览 */}
          <Card title={flowLabels.overviewTitle} className="mb-4">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <div className="mb-2">
                  <Text type="secondary">{flowLabels.progressLabel}</Text>
                </div>
                <Progress
                  percent={progress}
                  status={progress >= 100 ? "success" : "active"}
                  strokeWidth={12}
                />
              </div>
              <Divider type="vertical" style={{ height: 60 }} />
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ¥{formatAmount(totalPaid)}
                </div>
                <Text type="secondary">{flowLabels.doneLabel}</Text>
              </div>
              <Divider type="vertical" style={{ height: 60 }} />
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">
                  ¥{formatAmount(receivable)}
                </div>
                <Text type="secondary">{flowLabels.balanceLabel}</Text>
              </div>
            </div>
          </Card>

          {/* 回款计划 */}
          <Card title={flowLabels.planTitle} className="mb-4">
            <Table
              columns={planColumns.map((item) =>
                item.key === "status"
                  ? {
                      ...item,
                      render: (status: string) => {
                        const statusMap: Record<
                          string,
                          { label: string; color: string }
                        > = {
                          PENDING: {
                            label: flowLabels.planStatusPending,
                            color: "default",
                          },
                          PARTIAL: {
                            label: flowLabels.planStatusPartial,
                            color: "processing",
                          },
                          COMPLETED: { label: "已完成", color: "success" },
                        };
                        const info = statusMap[status] || {
                          label: status,
                          color: "default",
                        };
                        return <Tag color={info.color}>{info.label}</Tag>;
                      },
                    }
                  : item,
              )}
              dataSource={contract.paymentPlans || []}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: `暂无${flowLabels.planTitle}` }}
            />
          </Card>

          {/* 回款记录 */}
          <Card title={flowLabels.recordTitle}>
            <Table
              columns={recordColumns.map((item) => {
                if (item.key === "amount")
                  return { ...item, title: flowLabels.amountColumn };
                if (item.key === "paymentDate")
                  return { ...item, title: flowLabels.dateColumn };
                if (item.key === "paymentMethod")
                  return { ...item, title: flowLabels.methodColumn };
                return item;
              })}
              dataSource={contract.paymentRecords || []}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: `暂无${flowLabels.recordTitle}` }}
            />
          </Card>
        </>
      )}

      <Card title="开票情况" className="mt-4">
        <div className="flex items-center gap-8 mb-4">
          <div className="flex-1">
            <div className="mb-2">
              <Text type="secondary">开票进度</Text>
            </div>
            <Progress
              percent={invoiceProgress}
              status={invoiceProgress >= 100 ? "success" : "active"}
              strokeWidth={10}
            />
          </div>
          <Divider type="vertical" style={{ height: 60 }} />
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ¥{formatAmount(totalInvoiced)}
            </div>
            <Text type="secondary">已开票</Text>
          </div>
          <Divider type="vertical" style={{ height: 60 }} />
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">
              ¥{formatAmount(uninvoiced)}
            </div>
            <Text type="secondary">未开票</Text>
          </div>
        </div>

        <Table
          columns={invoiceColumns}
          dataSource={contract.invoices || []}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{ emptyText: "暂无开票记录" }}
          scroll={{ x: 1140 }}
        />
      </Card>
    </div>
  );
}
