"use client";

// InfFinanceMs - 发票管理页面

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  message,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  FileSearchOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { UploadFile, UploadProps } from "antd/es/upload/interface";
import apiClient, { api } from "@/lib/api";
import {
  INVOICE_DIRECTION_COLORS,
  INVOICE_DIRECTION_LABELS,
} from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";
import InvoiceCreateModal from "./InvoiceCreateModal";
import InvoiceImportModal from "./InvoiceImportModal";
import InvoiceTable from "./InvoiceTable";
import {
  INVOICE_CONTRACT_HINT,
  INVOICE_PAGE_TITLE,
  type ContractListResponse,
  type ContractOptionItem,
  type ContractSelectOption,
  type InvoiceDirection,
  type InvoiceFormValues,
  type InvoiceImportError,
  type InvoiceImportPreview,
  type InvoiceImportSummary,
  type InvoiceListResponse,
  type InvoiceManagementPageProps,
  type Invoice,
} from "./types";
import {
  getTaxRateDisplay,
  isContractMatchedDirection,
  resolveAttachmentUrl,
  resolveDirectionByContractType,
} from "./utils";

const { Title } = Typography;

interface UploadedFilePayload {
  url: string;
  filename: string;
  originalName?: string;
}

type ImportErrorCarrier = {
  details?: { errors?: InvoiceImportError[] };
  data?: { details?: { errors?: InvoiceImportError[] } };
};

export default function InvoiceManagementPage({
  fixedDirection,
  hidePageTitle = false,
}: InvoiceManagementPageProps) {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [directionFilter, setDirectionFilter] = useState<
    InvoiceDirection | undefined
  >(fixedDirection);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [contracts, setContracts] = useState<ContractOptionItem[]>([]);
  const [form] = Form.useForm<InvoiceFormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [createFileList, setCreateFileList] = useState<UploadFile[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    filename: string;
  } | null>(null);

  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importContractId, setImportContractId] = useState<
    string | undefined
  >();
  const [importPreview, setImportPreview] =
    useState<InvoiceImportPreview | null>(null);
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [contractSearching, setContractSearching] = useState(false);

  const extractImportErrors = useCallback(
    (error: unknown): InvoiceImportError[] => {
      if (!error || typeof error !== "object") return [];
      const payload = error as ImportErrorCarrier;
      if (Array.isArray(payload.details?.errors)) {
        return payload.details.errors;
      }
      if (Array.isArray(payload.data?.details?.errors)) {
        return payload.data.details.errors;
      }
      return [];
    },
    [],
  );

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const effectiveDirection = fixedDirection || directionFilter;
      if (effectiveDirection) params.direction = effectiveDirection;

      const response = await api.get<InvoiceListResponse>("/invoices", {
        params,
      });
      setInvoices(response.items || []);
      setTotal(response.total || 0);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载失败"));
    } finally {
      setLoading(false);
    }
  }, [directionFilter, fixedDirection, keyword, page, pageSize, statusFilter]);

  const fetchContracts = useCallback(
    async (searchKeyword?: string) => {
      setContractSearching(true);
      try {
        const trimmedKeyword = (searchKeyword || "").trim();
        const response = await api.get<ContractListResponse>("/contracts", {
          params: {
            page: 1,
            pageSize: 100,
            keyword: trimmedKeyword || undefined,
            sortBy: "signDate",
            sortOrder: "desc",
          },
        });

        const items = response.items || [];
        const filteredItems = fixedDirection
          ? items.filter(
              (item) =>
                resolveDirectionByContractType(item.contractType) ===
                fixedDirection,
            )
          : items;
        setContracts(filteredItems);
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "加载合同列表失败"));
      } finally {
        setContractSearching(false);
      }
    },
    [fixedDirection],
  );

  const resetImportState = useCallback(() => {
    setImportFileList([]);
    setImportFiles([]);
    setImportContractId(undefined);
    setImportPreview(null);
    setAllowPartialImport(false);
    setPreviewingImport(false);
    setConfirmingImport(false);
  }, []);

  const openCreateModal = useCallback(() => {
    void fetchContracts("");
    form.resetFields();
    setCreateFileList([]);
    setUploadedFile(null);
    setCreateModalVisible(true);
  }, [fetchContracts, form]);

  const openImportModal = useCallback(() => {
    void fetchContracts("");
    resetImportState();
    setImportModalVisible(true);
  }, [fetchContracts, resetImportState]);

  const handlePreviewImport = useCallback(async () => {
    if (!importFiles.length) {
      message.warning("请先选择要上传的发票文件");
      return;
    }
    if (!importContractId) {
      message.warning("请先选择关联合同");
      return;
    }

    setPreviewingImport(true);
    try {
      const formData = new FormData();
      formData.append("contractId", importContractId);
      if (fixedDirection) {
        formData.append("expectedDirection", fixedDirection);
      }
      importFiles.forEach((file) => formData.append("files", file));

      const response = await apiClient.post(
        "/invoices/import/preview",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const preview = response.data as InvoiceImportPreview;
      setImportPreview(preview);
      if (preview.invalid > 0) {
        setAllowPartialImport(false);
      }
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "解析预览失败"));
    } finally {
      setPreviewingImport(false);
    }
  }, [fixedDirection, importContractId, importFiles]);

  const handleConfirmImport = useCallback(async () => {
    if (!importFiles.length) {
      message.warning("请先选择要上传的发票文件");
      return;
    }
    if (!importContractId) {
      message.warning("请先选择关联合同");
      return;
    }
    if (!importPreview) {
      message.warning("请先执行解析预览");
      return;
    }
    if (importPreview.invalid > 0 && !allowPartialImport) {
      message.warning("存在异常行，请勾选“忽略错误并仅导入有效行”后继续");
      return;
    }

    setConfirmingImport(true);
    try {
      const formData = new FormData();
      formData.append("contractId", importContractId);
      formData.append("allowPartial", allowPartialImport ? "true" : "false");
      if (fixedDirection) {
        formData.append("expectedDirection", fixedDirection);
      }
      importFiles.forEach((file) => formData.append("files", file));

      const response = await apiClient.post("/invoices/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const summary = response.data as InvoiceImportSummary;

      if (summary.failed > 0) {
        setImportPreview({
          total: summary.total,
          valid: summary.success,
          invalid: summary.failed,
          errors: summary.errors || [],
          samples: [],
        });
        if (summary.success === 0) {
          message.error(
            `本次未导入成功数据：失败 ${summary.failed} 条，请根据错误修正后重试`,
          );
        } else {
          message.warning(
            `导入完成：成功 ${summary.success} 条，失败 ${summary.failed} 条`,
          );
        }
      } else {
        message.success(`导入成功：共 ${summary.success} 条`);
        setImportModalVisible(false);
        resetImportState();
      }
      await fetchInvoices();
    } catch (error: unknown) {
      const details = extractImportErrors(error);
      if (details.length > 0 && importPreview) {
        setImportPreview({
          ...importPreview,
          errors: details,
          invalid: details.length,
        });
      }
      message.error(getErrorMessage(error, "批量导入失败"));
    } finally {
      setConfirmingImport(false);
    }
  }, [
    allowPartialImport,
    extractImportErrors,
    fetchInvoices,
    fixedDirection,
    importContractId,
    importFiles,
    importPreview,
    resetImportState,
  ]);

  const handleCreate = useCallback(async () => {
    try {
      const values = await form.validateFields();
      const selectedContract = contracts.find(
        (item) => item.id === values.contractId,
      );
      if (!isContractMatchedDirection(selectedContract, fixedDirection)) {
        if (fixedDirection) {
          message.error(
            `当前模块仅支持${INVOICE_DIRECTION_LABELS[fixedDirection]}，请重新选择合同`,
          );
        }
        return;
      }

      setSubmitting(true);
      await api.post("/invoices", {
        ...values,
        invoiceDate: values.invoiceDate.format("YYYY-MM-DD"),
        attachmentUrl: uploadedFile?.url,
        attachmentName: uploadedFile?.filename,
        expectedDirection: fixedDirection,
      });
      message.success("创建成功");
      setCreateModalVisible(false);
      await fetchInvoices();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "创建失败"));
    } finally {
      setSubmitting(false);
    }
  }, [
    contracts,
    fetchInvoices,
    fixedDirection,
    form,
    uploadedFile?.filename,
    uploadedFile?.url,
  ]);

  const handleVoid = useCallback(
    async (id: string) => {
      try {
        await api.patch(`/invoices/${id}/void`);
        message.success("作废成功");
        await fetchInvoices();
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "作废失败"));
      }
    },
    [fetchInvoices],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/invoices/${id}`);
        message.success("删除成功");
        await fetchInvoices();
      } catch (error: unknown) {
        message.error(getErrorMessage(error, "删除失败"));
      }
    },
    [fetchInvoices],
  );

  const uploadProps: UploadProps = useMemo(
    () => ({
      name: "file",
      multiple: false,
      maxCount: 1,
      fileList: createFileList,
      accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx",
      customRequest: async ({ file, onSuccess, onError }) => {
        try {
          const formData = new FormData();
          formData.append("file", file as File);

          const response = await apiClient.post(
            "/upload?category=invoices",
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
            },
          );
          const payload = response.data as UploadedFilePayload;

          setUploadedFile({
            url: payload.url,
            filename: payload.originalName || payload.filename,
          });
          onSuccess?.(response.data);
          message.success("附件上传成功");
        } catch (error: unknown) {
          onError?.(error as Error);
          message.error(getErrorMessage(error, "附件上传失败"));
        }
      },
      onChange(info) {
        setCreateFileList(info.fileList);
      },
      onRemove() {
        setUploadedFile(null);
        return true;
      },
    }),
    [createFileList],
  );

  const importUploadProps: UploadProps = useMemo(
    () => ({
      multiple: true,
      accept: ".pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xlsx,.xls",
      fileList: importFileList,
      beforeUpload: () => false,
      onChange(info) {
        setImportFileList(info.fileList);
        const selectedFiles = info.fileList
          .map((item) => item.originFileObj)
          .filter(Boolean) as File[];
        setImportFiles(selectedFiles);
      },
      onRemove(file) {
        const nextList = importFileList.filter((item) => item.uid !== file.uid);
        setImportFileList(nextList);
        setImportFiles(
          nextList.map((item) => item.originFileObj).filter(Boolean) as File[],
        );
        return true;
      },
    }),
    [importFileList],
  );

  const contractOptions = useMemo<ContractSelectOption[]>(
    () =>
      contracts.map((contract) => ({
        value: contract.id,
        label: `${contract.contractNo} - ${contract.name}${contract.customer?.name ? `（${contract.customer.name}）` : ""}`,
      })),
    [contracts],
  );

  const selectedNewInvoiceContractId = Form.useWatch("contractId", form);
  const selectedNewInvoiceContract = useMemo(
    () => contracts.find((item) => item.id === selectedNewInvoiceContractId),
    [contracts, selectedNewInvoiceContractId],
  );
  const selectedNewInvoiceDirection = selectedNewInvoiceContract
    ? resolveDirectionByContractType(selectedNewInvoiceContract.contractType)
    : undefined;

  const selectedImportContract = useMemo(
    () => contracts.find((item) => item.id === importContractId),
    [contracts, importContractId],
  );

  useEffect(() => {
    void fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    if (fixedDirection) {
      setDirectionFilter(fixedDirection);
    }
  }, [fixedDirection]);

  return (
    <div>
      <div
        className={`flex mb-4 ${hidePageTitle ? "justify-end" : "justify-between items-center"}`}
      >
        {!hidePageTitle && (
          <Title level={4} className="!mb-0">
            {fixedDirection ? INVOICE_PAGE_TITLE[fixedDirection] : "发票管理"}
          </Title>
        )}
        <Space>
          <Button icon={<FileSearchOutlined />} onClick={openImportModal}>
            上传发票并解析
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
          >
            新增发票
          </Button>
        </Space>
      </div>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索发票号/合同编号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="发票状态"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 120 }}
            allowClear
            options={[
              { value: "ISSUED", label: "已开具" },
              { value: "VOIDED", label: "已作废" },
            ]}
          />
          {!fixedDirection && (
            <Select
              placeholder="发票方向"
              value={directionFilter}
              onChange={(value) => setDirectionFilter(value)}
              style={{ width: 140 }}
              allowClear
              options={[
                { value: "INBOUND", label: "进项发票" },
                { value: "OUTBOUND", label: "出项发票" },
              ]}
            />
          )}
          {fixedDirection && (
            <Tag color={INVOICE_DIRECTION_COLORS[fixedDirection]}>
              当前模块：{INVOICE_DIRECTION_LABELS[fixedDirection]}（
              {INVOICE_CONTRACT_HINT[fixedDirection]}）
            </Tag>
          )}
        </Space>
      </Card>

      <InvoiceTable
        dataSource={invoices}
        loading={loading}
        current={page}
        pageSize={pageSize}
        total={total}
        onPageChange={(nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        }}
        onVoid={handleVoid}
        onDelete={handleDelete}
        resolveAttachmentUrl={resolveAttachmentUrl}
        getTaxRateDisplay={getTaxRateDisplay}
      />

      <InvoiceCreateModal
        open={createModalVisible}
        submitting={submitting}
        form={form}
        fixedDirection={fixedDirection}
        contractSearching={contractSearching}
        contractOptions={contractOptions}
        selectedDirection={selectedNewInvoiceDirection}
        uploadProps={uploadProps}
        onSearchContracts={fetchContracts}
        onCancel={() => setCreateModalVisible(false)}
        onSubmit={handleCreate}
      />

      <InvoiceImportModal
        open={importModalVisible}
        fixedDirection={fixedDirection}
        contractOptions={contractOptions}
        selectedContract={selectedImportContract}
        selectedContractId={importContractId}
        contractSearching={contractSearching}
        importUploadProps={importUploadProps}
        importPreview={importPreview}
        allowPartialImport={allowPartialImport}
        previewingImport={previewingImport}
        confirmingImport={confirmingImport}
        onClose={() => {
          if (previewingImport || confirmingImport) return;
          setImportModalVisible(false);
          resetImportState();
        }}
        onSearchContracts={fetchContracts}
        onSelectContract={(contractId) => {
          setImportContractId(contractId);
          setImportPreview(null);
          setAllowPartialImport(false);
        }}
        onPreviewImport={handlePreviewImport}
        onConfirmImport={handleConfirmImport}
        onChangeAllowPartialImport={setAllowPartialImport}
      />
    </div>
  );
}
