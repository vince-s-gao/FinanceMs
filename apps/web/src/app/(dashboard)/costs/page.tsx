"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { UploadProps } from "antd";
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import dayjs from "dayjs";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  COST_SOURCE_LABELS,
  FEE_TYPE_LABELS,
  formatAmount,
  formatDate,
} from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import type {
  ContractOption,
  CostItem,
  PaginatedData,
  ProjectOption,
} from "@inffinancems/shared";

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface CreateOrUpdateCostFormData {
  feeType: string;
  amount: number;
  occurDate: dayjs.Dayjs;
  projectId: string;
  contractId?: string;
  description?: string;
}

interface CostImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

interface CostSummaryResponse {
  totalAmount: number;
  totalCount: number;
  directAmount: number;
  reimbursementAmount: number;
  byFeeType: Array<{
    feeType: string;
    feeTypeLabel: string;
    amount: number;
    count: number;
  }>;
  topProjects: Array<{
    projectId: string;
    projectCode: string;
    projectName: string;
    amount: number;
    count: number;
  }>;
  topContracts: Array<{
    contractId: string | null;
    contractNo: string;
    contractName: string;
    amount: number;
    count: number;
  }>;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildDatePart() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export default function CostsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [feeTypeFilter, setFeeTypeFilter] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<string | undefined>();
  const [projectFilter, setProjectFilter] = useState<string | undefined>();
  const [contractFilter, setContractFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCost, setEditingCost] = useState<CostItem | null>(null);
  const [form] = Form.useForm<CreateOrUpdateCostFormData>();

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<CostImportResult | null>(
    null,
  );

  const queryClient = useQueryClient();
  const startDate = dateRange?.[0]?.format("YYYY-MM-DD");
  const endDate = dateRange?.[1]?.format("YYYY-MM-DD");

  const queryParams = useMemo(
    () => ({
      page,
      pageSize,
      keyword: debouncedKeyword || undefined,
      feeType: feeTypeFilter,
      source: sourceFilter,
      projectId: projectFilter,
      contractId: contractFilter,
      startDate,
      endDate,
    }),
    [
      contractFilter,
      debouncedKeyword,
      endDate,
      feeTypeFilter,
      page,
      pageSize,
      projectFilter,
      sourceFilter,
      startDate,
    ],
  );

  const costsQuery = useQuery({
    queryKey: [
      "costs",
      page,
      pageSize,
      debouncedKeyword,
      feeTypeFilter,
      sourceFilter,
      projectFilter,
      contractFilter,
      startDate,
      endDate,
    ],
    queryFn: () =>
      api.get<PaginatedData<CostItem>>("/costs", { params: queryParams }),
    placeholderData: keepPreviousData,
  });

  const summaryQuery = useQuery({
    queryKey: [
      "costs-summary",
      debouncedKeyword,
      feeTypeFilter,
      sourceFilter,
      projectFilter,
      contractFilter,
      startDate,
      endDate,
    ],
    queryFn: () =>
      api.get<CostSummaryResponse>("/costs/summary", {
        params: {
          keyword: debouncedKeyword || undefined,
          feeType: feeTypeFilter,
          source: sourceFilter,
          projectId: projectFilter,
          contractId: contractFilter,
          startDate,
          endDate,
        },
      }),
  });

  const contractsQuery = useQuery({
    queryKey: ["contracts", "options", "costs"],
    queryFn: () =>
      api.get<PaginatedData<ContractOption>>("/contracts", {
        params: { pageSize: 200, sortBy: "signDate", sortOrder: "desc" },
      }),
    staleTime: 5 * 60 * 1000,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "options", "costs"],
    queryFn: () =>
      api.get<PaginatedData<ProjectOption>>("/projects", {
        params: { pageSize: 200, status: "ACTIVE" },
      }),
    staleTime: 5 * 60 * 1000,
  });

  const invalidateCostQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["costs"] }),
      queryClient.invalidateQueries({ queryKey: ["costs-summary"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post("/costs", payload),
    onSuccess: async () => {
      message.success("创建成功");
      setModalVisible(false);
      form.resetFields();
      setEditingCost(null);
      await invalidateCostQueries();
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, "创建失败"));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Record<string, unknown>;
    }) => api.patch(`/costs/${id}`, payload),
    onSuccess: async () => {
      message.success("更新成功");
      setModalVisible(false);
      form.resetFields();
      setEditingCost(null);
      await invalidateCostQueries();
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, "更新失败"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/costs/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["costs"] });
      const queryKey = [
        "costs",
        page,
        pageSize,
        debouncedKeyword,
        feeTypeFilter,
        sourceFilter,
        projectFilter,
        contractFilter,
        startDate,
        endDate,
      ] as const;
      const previous =
        queryClient.getQueryData<PaginatedData<CostItem>>(queryKey);
      if (previous) {
        queryClient.setQueryData<PaginatedData<CostItem>>(queryKey, {
          ...previous,
          items: previous.items.filter((item) => item.id !== id),
          total: Math.max(previous.total - 1, 0),
        });
      }
      return { previous, queryKey };
    },
    onError: (error: unknown, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
      message.error(getErrorMessage(error, "删除失败"));
    },
    onSuccess: () => {
      message.success("删除成功");
    },
    onSettled: async () => {
      await invalidateCostQueries();
    },
  });

  useEffect(() => {
    if (!costsQuery.data) return;
    const hasNextPage = page * pageSize < costsQuery.data.total;
    if (!hasNextPage) return;

    queryClient.prefetchQuery({
      queryKey: [
        "costs",
        page + 1,
        pageSize,
        debouncedKeyword,
        feeTypeFilter,
        sourceFilter,
        projectFilter,
        contractFilter,
        startDate,
        endDate,
      ],
      queryFn: () =>
        api.get<PaginatedData<CostItem>>("/costs", {
          params: { ...queryParams, page: page + 1 },
        }),
    });
  }, [
    contractFilter,
    costsQuery.data,
    debouncedKeyword,
    endDate,
    feeTypeFilter,
    page,
    pageSize,
    projectFilter,
    queryClient,
    queryParams,
    sourceFilter,
    startDate,
  ]);

  const handleAdd = () => {
    setEditingCost(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: CostItem) => {
    if (record.source !== "DIRECT") {
      return;
    }
    setEditingCost(record);
    form.setFieldsValue({
      feeType: record.feeType,
      amount: Number(record.amount),
      occurDate: dayjs(record.occurDate),
      projectId: record.project?.id,
      contractId: record.contract?.id || undefined,
      description: record.description || undefined,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload: Record<string, unknown> = {
        feeType: values.feeType,
        amount: values.amount,
        occurDate: values.occurDate.format("YYYY-MM-DD"),
        projectId: values.projectId,
        description: values.description || undefined,
      };

      if (editingCost) {
        payload.contractId = values.contractId || null;
        await updateMutation.mutateAsync({ id: editingCost.id, payload });
      } else {
        if (values.contractId) payload.contractId = values.contractId;
        await createMutation.mutateAsync(payload);
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "提交失败"));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleResetFilters = () => {
    setKeyword("");
    setFeeTypeFilter(undefined);
    setSourceFilter(undefined);
    setProjectFilter(undefined);
    setContractFilter(undefined);
    setDateRange(null);
    setPage(1);
  };

  const handleExport = async () => {
    try {
      const blob = await api.get<Blob>("/costs/export/excel", {
        params: {
          keyword: debouncedKeyword || undefined,
          feeType: feeTypeFilter,
          source: sourceFilter,
          projectId: projectFilter,
          contractId: contractFilter,
          startDate,
          endDate,
        },
        responseType: "blob",
      });
      downloadBlob(blob, `costs-${buildDatePart()}.xlsx`);
      message.success("导出成功");
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "导出失败"));
    }
  };

  const importUploadProps: UploadProps = {
    showUploadList: false,
    accept: ".csv,.xlsx,.xls",
    customRequest: async ({ file, onSuccess, onError }) => {
      setImporting(true);
      try {
        const formData = new FormData();
        formData.append("file", file as File);
        const result = await api.post<CostImportResult>(
          "/costs/import",
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          },
        );
        setImportResult(result);
        if (result.failed > 0) {
          message.warning(
            `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`,
          );
        } else {
          message.success(`导入成功：共 ${result.success} 条`);
        }
        await invalidateCostQueries();
        onSuccess?.(result);
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "导入失败"));
        onError?.(error as Error);
      } finally {
        setImporting(false);
      }
    },
  };

  const columns = [
    {
      title: "费用类型",
      dataIndex: "feeType",
      key: "feeType",
      width: 100,
      render: (value: string) => FEE_TYPE_LABELS[value],
    },
    {
      title: "金额",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      render: (value: number) => <Text strong>¥{formatAmount(value)}</Text>,
    },
    {
      title: "发生日期",
      dataIndex: "occurDate",
      key: "occurDate",
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: "来源",
      dataIndex: "source",
      key: "source",
      width: 110,
      render: (value: string) => (
        <Tag color={value === "DIRECT" ? "blue" : "green"}>
          {COST_SOURCE_LABELS[value]}
        </Tag>
      ),
    },
    {
      title: "关联项目",
      key: "project",
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: CostItem) =>
        record.project ? (
          <div>
            <div>{record.project.code}</div>
            <Text type="secondary" className="text-xs">
              {record.project.name}
            </Text>
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: "关联合同",
      key: "contract",
      width: 220,
      ellipsis: true,
      render: (_: unknown, record: CostItem) =>
        record.contract ? (
          <div>
            <div>{record.contract.contractNo}</div>
            <Text type="secondary" className="text-xs">
              {record.contract.name}
            </Text>
          </div>
        ) : (
          "-"
        ),
    },
    {
      title: "说明",
      dataIndex: "description",
      key: "description",
      width: 220,
      ellipsis: true,
      render: (value: string | undefined) => value || "-",
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      fixed: "right" as const,
      render: (_: unknown, record: CostItem) =>
        record.source === "DIRECT" ? (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </Button>
            <Popconfirm
              title="确定删除该费用吗？"
              description="删除后数据将无法恢复"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ) : (
          <Text type="secondary">报销生成不可操作</Text>
        ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          费用管理
        </Title>
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalVisible(true)}
          >
            批量导入
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            导出Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            直接录入
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="费用总额"
              value={summaryQuery.data?.totalAmount || 0}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="直接录入"
              value={summaryQuery.data?.directAmount || 0}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="报销生成"
              value={summaryQuery.data?.reimbursementAmount || 0}
              prefix="¥"
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="费用记录数"
              value={summaryQuery.data?.totalCount || 0}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} lg={12}>
          <Card title="项目费用Top 5" size="small">
            <Table
              size="small"
              rowKey="projectId"
              pagination={false}
              dataSource={summaryQuery.data?.topProjects || []}
              columns={[
                {
                  title: "项目",
                  key: "project",
                  render: (
                    _: unknown,
                    row: CostSummaryResponse["topProjects"][number],
                  ) => (
                    <span>
                      {row.projectCode} - {row.projectName}
                    </span>
                  ),
                },
                {
                  title: "金额",
                  dataIndex: "amount",
                  key: "amount",
                  width: 140,
                  render: (value: number) => `¥${formatAmount(value)}`,
                },
                {
                  title: "条数",
                  dataIndex: "count",
                  key: "count",
                  width: 90,
                },
              ]}
              locale={{ emptyText: "暂无数据" }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="合同费用Top 5" size="small">
            <Table
              size="small"
              rowKey={(row) => row.contractId || row.contractNo}
              pagination={false}
              dataSource={summaryQuery.data?.topContracts || []}
              columns={[
                {
                  title: "合同",
                  key: "contract",
                  render: (
                    _: unknown,
                    row: CostSummaryResponse["topContracts"][number],
                  ) => (
                    <span>
                      {row.contractNo} - {row.contractName}
                    </span>
                  ),
                },
                {
                  title: "金额",
                  dataIndex: "amount",
                  key: "amount",
                  width: 140,
                  render: (value: number) => `¥${formatAmount(value)}`,
                },
                {
                  title: "条数",
                  dataIndex: "count",
                  key: "count",
                  width: 90,
                },
              ]}
              locale={{ emptyText: "暂无数据" }}
            />
          </Card>
        </Col>
      </Row>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索说明/项目/合同/报销单号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => {
              setPage(1);
              setKeyword(event.target.value);
            }}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="费用类型"
            value={feeTypeFilter}
            onChange={(value) => {
              setPage(1);
              setFeeTypeFilter(value);
            }}
            style={{ width: 140 }}
            allowClear
          >
            {Object.entries(FEE_TYPE_LABELS).map(([key, value]) => (
              <Option key={key} value={key}>
                {value}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="费用来源"
            value={sourceFilter}
            onChange={(value) => {
              setPage(1);
              setSourceFilter(value);
            }}
            style={{ width: 140 }}
            allowClear
          >
            <Option value="DIRECT">直接录入</Option>
            <Option value="REIMBURSEMENT">报销生成</Option>
          </Select>
          <Select
            placeholder="关联项目"
            value={projectFilter}
            onChange={(value) => {
              setPage(1);
              setProjectFilter(value);
            }}
            style={{ width: 220 }}
            allowClear
            showSearch
            optionFilterProp="children"
            loading={projectsQuery.isFetching}
          >
            {(projectsQuery.data?.items || []).map((item) => (
              <Option key={item.id} value={item.id}>
                {item.code} - {item.name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="关联合同"
            value={contractFilter}
            onChange={(value) => {
              setPage(1);
              setContractFilter(value);
            }}
            style={{ width: 260 }}
            allowClear
            showSearch
            optionFilterProp="children"
            loading={contractsQuery.isFetching}
          >
            {(contractsQuery.data?.items || []).map((item) => (
              <Option key={item.id} value={item.id}>
                {item.contractNo} - {item.name}
              </Option>
            ))}
          </Select>
          <RangePicker
            value={dateRange}
            onChange={(value) => {
              setPage(1);
              setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null);
            }}
          />
          <Button icon={<ReloadOutlined />} onClick={handleResetFilters}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={costsQuery.data?.items || []}
        rowKey="id"
        loading={costsQuery.isFetching || summaryQuery.isFetching}
        virtual
        scroll={{ y: 560, x: 1600 }}
        pagination={{
          current: page,
          pageSize,
          total: costsQuery.data?.total || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />

      <Modal
        title={editingCost ? "编辑费用" : "直接录入费用"}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => {
          setModalVisible(false);
          setEditingCost(null);
        }}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        width={680}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="feeType"
            label="费用类型"
            rules={[{ required: true, message: "请选择费用类型" }]}
          >
            <Select placeholder="请选择费用类型">
              {Object.entries(FEE_TYPE_LABELS).map(([key, value]) => (
                <Option key={key} value={key}>
                  {value}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="金额"
            rules={[{ required: true, message: "请输入金额" }]}
          >
            <InputNumber
              style={{ width: "100%" }}
              min={0.01}
              precision={2}
              placeholder="请输入金额"
            />
          </Form.Item>

          <Form.Item
            name="occurDate"
            label="发生日期"
            rules={[{ required: true, message: "请选择发生日期" }]}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="关联项目"
            rules={[{ required: true, message: "请选择关联项目" }]}
          >
            <Select
              placeholder="请选择项目"
              loading={projectsQuery.isFetching}
              options={(projectsQuery.data?.items || []).map((item) => ({
                value: item.id,
                label: `${item.code} - ${item.name}`,
              }))}
              showSearch
            />
          </Form.Item>

          <Form.Item name="contractId" label="关联合同（可选）">
            <Select
              placeholder="请选择合同"
              loading={contractsQuery.isFetching}
              options={(contractsQuery.data?.items || []).map((item) => ({
                value: item.id,
                label: `${item.contractNo} - ${item.name}`,
              }))}
              allowClear
              showSearch
            />
          </Form.Item>

          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="请输入说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="批量导入费用（CSV/Excel）"
        open={importModalVisible}
        onCancel={() => {
          if (importing) return;
          setImportModalVisible(false);
          setImportResult(null);
        }}
        footer={null}
        width={760}
      >
        <Alert
          type="info"
          className="mb-3"
          message="模板字段建议：费用类型、金额、发生日期、项目（项目编号/名称/ID）、合同（可选）、说明（可选）"
        />
        <Upload {...importUploadProps}>
          <Button icon={<UploadOutlined />} loading={importing}>
            选择文件并导入
          </Button>
        </Upload>

        {importResult && (
          <div className="mt-4">
            <Alert
              type={importResult.failed > 0 ? "warning" : "success"}
              message={`总计 ${importResult.total} 行，成功 ${importResult.success} 行，失败 ${importResult.failed} 行`}
              showIcon
            />

            {importResult.errors.length > 0 && (
              <Card
                size="small"
                className="mt-3"
                title="错误明细（最多展示前20条）"
              >
                <ul className="mb-0 pl-5">
                  {importResult.errors.slice(0, 20).map((item) => (
                    <li key={`${item.row}-${item.message}`}>
                      第 {item.row} 行：{item.message}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
