'use client';

// InfFinanceMs - 合同管理页面

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Space,
  Select,
  message,
  Typography,
  Card,
  DatePicker,
  Upload,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import apiClient from '@/lib/api';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { useExport } from '@/hooks/useExport';
import { useEntityDelete } from '@/hooks/useEntityDelete';
import { getErrorMessage } from '@/lib/error';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import ContractsTable from '@/components/contracts/ContractsTable';
import ContractImportPreviewModal from '@/components/contracts/ContractImportPreviewModal';
import ContractAttachmentBatchModal from '@/components/contracts/ContractAttachmentBatchModal';
import ContractImportHistoryModal from '@/components/contracts/ContractImportHistoryModal';
import type {
  BatchAttachmentBindResult,
  Contract,
  DictionaryItem,
  ImportHistoryItem,
  ImportPreviewResult,
  SearchFilters,
} from '@/components/contracts/types';

const { Title, Text } = Typography;
const { Option } = Select;

const IMPORT_HISTORY_LIMIT = 10;

export default function ContractsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const [keywordInput, setKeywordInput] = useState('');
  const [customerKeywordInput, setCustomerKeywordInput] = useState('');
  const [signYearInput, setSignYearInput] = useState<number | undefined>();
  const [contractTypeInput, setContractTypeInput] = useState<string | undefined>();
  const [startDateInput, setStartDateInput] = useState<Dayjs | null>(null);
  const [endDateInput, setEndDateInput] = useState<Dayjs | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({});
  const [contractTypes, setContractTypes] = useState<DictionaryItem[]>([]);
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewResult | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [importHistoryOpen, setImportHistoryOpen] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [importHistoryLoading, setImportHistoryLoading] = useState(false);
  const [attachmentBatchOpen, setAttachmentBatchOpen] = useState(false);
  const [attachmentBatchFileList, setAttachmentBatchFileList] = useState<UploadFile[]>([]);
  const [attachmentBatchFiles, setAttachmentBatchFiles] = useState<File[]>([]);
  const [attachmentAllowOverwrite, setAttachmentAllowOverwrite] = useState(true);
  const [bindingAttachments, setBindingAttachments] = useState(false);
  const [attachmentBatchResult, setAttachmentBatchResult] = useState<BatchAttachmentBindResult | null>(null);
  const { exporting, handleExport: triggerExport } = useExport('/contracts', 'contracts');
  const { deleteOne, deleteBatch, batchDeleting } = useEntityDelete('/contracts', '合同');

  const normalizeImportErrorMessage = (error: unknown, fallback: string) => {
    const payload = error as { message?: string; data?: { message?: string } };
    const rawMessage =
      payload?.message ||
      (typeof payload?.data?.message === 'string' ? payload.data.message : '') ||
      fallback;
    if (typeof rawMessage === 'string' && rawMessage.includes('仅支持 CSV 文件')) {
      return '后端服务仍在旧版本（仅支持CSV），请重启 API 服务后再上传 Excel，或先上传 CSV。';
    }
    return rawMessage || fallback;
  };

  const contractTypeMap = useMemo(() => {
    return contractTypes.reduce<Record<string, DictionaryItem>>((acc, item) => {
      acc[item.code] = item;
      return acc;
    }, {});
  }, [contractTypes]);

  const yearOptions = useMemo(() => {
    const currentYear = dayjs().year();
    return Array.from({ length: 10 }).map((_, index) => currentYear - index);
  }, []);
  const isAdmin = currentUser?.role === 'ADMIN';

  const getContractTypeInfo = (code?: string | null) => {
    if (!code) {
      return { name: '-', color: 'default' };
    }
    const matched = contractTypeMap[code];
    return {
      name: matched?.name || code,
      color: matched?.color || 'default',
    };
  };

  const fetchContractTypes = useCallback(async () => {
    try {
      const res = await api.get<DictionaryItem[]>('/dictionaries/by-type/CONTRACT_TYPE');
      setContractTypes(res);
    } catch {
      setContractTypes([
        { id: '1', code: 'SALES', name: '销售合同', color: 'blue' },
        { id: '2', code: 'PURCHASE', name: '采购合同', color: 'cyan' },
        { id: '3', code: 'SERVICE', name: '服务合同', color: 'green' },
        { id: '4', code: 'OTHER', name: '其他', color: 'default' },
      ]);
    }
  }, []);

  // 加载合同列表
  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.customerKeyword) params.customerKeyword = filters.customerKeyword;
      if (filters.signYear) params.signYear = filters.signYear;
      if (filters.contractType) params.contractType = filters.contractType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const res = await api.get<{ items: Contract[]; total: number }>('/contracts', { params });
      setContracts(res.items);
      setTotal(res.total);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载失败'));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  useEffect(() => {
    fetchContractTypes();
  }, [fetchContractTypes]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const handleSearch = () => {
    setPage(1);
    setFilters({
      keyword: keywordInput.trim() || undefined,
      customerKeyword: customerKeywordInput.trim() || undefined,
      signYear: signYearInput,
      contractType: contractTypeInput,
      startDate: startDateInput ? startDateInput.format('YYYY-MM-DD') : undefined,
      endDate: endDateInput ? endDateInput.format('YYYY-MM-DD') : undefined,
    });
  };

  const handleReset = () => {
    setKeywordInput('');
    setCustomerKeywordInput('');
    setSignYearInput(undefined);
    setContractTypeInput(undefined);
    setStartDateInput(null);
    setEndDateInput(null);
    setPage(1);
    setFilters({});
  };

  const handleExport = async () => {
    const params: Record<string, string | number> = {};
    if (filters.keyword) params.keyword = filters.keyword;
    if (filters.customerKeyword) params.customerKeyword = filters.customerKeyword;
    if (filters.signYear) params.signYear = filters.signYear;
    if (filters.contractType) params.contractType = filters.contractType;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    await triggerExport(params);
  };

  const handleDeleteOne = async (id: string) => {
    const success = await deleteOne(id);
    if (success) {
      setSelectedRowKeys((prev) => prev.filter((key) => key !== id));
      await fetchContracts();
    }
  };

  const handleBatchDeleteSelected = async () => {
    await deleteBatch(selectedRowKeys);
    setSelectedRowKeys([]);
    await fetchContracts();
  };

  const handleDownloadImportTemplate = async () => {
    try {
      const response = await apiClient.get('/contracts/import/template/excel', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contracts-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      message.error(normalizeImportErrorMessage(error, '下载导入模板失败'));
    }
  };

  const handleDownloadImportErrorReport = () => {
    if (!importPreview || importPreview.errors.length === 0) {
      message.info('当前没有可下载的错误数据');
      return;
    }
    downloadErrorReportCsv(importPreview.errors, `contracts-import-errors-${dayjs().format('YYYYMMDDHHmmss')}.csv`);
  };

  const downloadErrorReportCsv = (
    errors: Array<{ row: number; message: string }>,
    fileName: string,
  ) => {
    if (!errors.length) {
      message.info('当前没有可下载的错误数据');
      return;
    }
    const lines = [
      '行号,错误信息',
      ...errors.map((item) => `${item.row},"${item.message.replace(/"/g, '""')}"`),
    ];
    const csv = lines.join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const fetchImportHistory = useCallback(async () => {
    setImportHistoryLoading(true);
    try {
      const items = await api.get<ImportHistoryItem[]>('/contracts/import/history', {
        params: { limit: IMPORT_HISTORY_LIMIT },
      });
      setImportHistory(Array.isArray(items) ? items : []);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '加载导入历史失败'));
      setImportHistory([]);
    } finally {
      setImportHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!importHistoryOpen) return;
    fetchImportHistory();
  }, [fetchImportHistory, importHistoryOpen]);

  const clearImportHistory = async () => {
    try {
      await api.delete('/contracts/import/history');
      setImportHistory([]);
      message.success('导入历史已清空');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '清空导入历史失败'));
    }
  };

  const uploadProps: UploadProps = {
    accept: '.csv,.xlsx,.xls',
    showUploadList: false,
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const selectedFile = file as File;
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await apiClient.post('/contracts/import/csv/preview', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        setImportPreview(res.data as ImportPreviewResult);
        setPendingImportFile(selectedFile);
        setAllowPartialImport(false);
        setImportPreviewOpen(true);
        onSuccess?.(res.data);
      } catch (error: unknown) {
        message.error(normalizeImportErrorMessage(error, '导入预校验失败'));
        onError?.(error as Error);
      }
    },
  };

  const attachmentBatchUploadProps: UploadProps = {
    multiple: true,
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    fileList: attachmentBatchFileList,
    beforeUpload: () => false,
    onChange(info) {
      setAttachmentBatchFileList(info.fileList);
      const selected = info.fileList
        .map((item) => item.originFileObj)
        .filter(Boolean) as File[];
      setAttachmentBatchFiles(selected);
    },
    onRemove(file) {
      const nextList = attachmentBatchFileList.filter((item) => item.uid !== file.uid);
      setAttachmentBatchFileList(nextList);
      setAttachmentBatchFiles(nextList.map((item) => item.originFileObj).filter(Boolean) as File[]);
      return true;
    },
  };

  const resetAttachmentBatchState = () => {
    setAttachmentBatchFileList([]);
    setAttachmentBatchFiles([]);
    setAttachmentAllowOverwrite(true);
    setAttachmentBatchResult(null);
    setBindingAttachments(false);
  };

  const handleOpenAttachmentBatch = () => {
    resetAttachmentBatchState();
    setAttachmentBatchOpen(true);
  };

  const handleConfirmAttachmentBatch = async () => {
    if (!attachmentBatchFiles.length) {
      message.warning('请先选择要上传的附件文件');
      return;
    }

    setBindingAttachments(true);
    try {
      const formData = new FormData();
      formData.append('allowOverwrite', attachmentAllowOverwrite ? 'true' : 'false');
      attachmentBatchFiles.forEach((file) => formData.append('files', file));

      const res = await apiClient.post('/contracts/attachments/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = res.data as BatchAttachmentBindResult;
      setAttachmentBatchResult(result);

      if (result.failed === 0) {
        message.success(`附件绑定成功：共 ${result.success} 个合同`);
        setAttachmentBatchOpen(false);
        resetAttachmentBatchState();
      } else if (result.success > 0) {
        message.warning(`附件绑定完成：成功 ${result.success} 个，失败 ${result.failed} 个`);
      } else {
        message.error(`附件绑定失败：${result.failed} 个文件未匹配成功`);
      }

      await fetchContracts();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '批量绑定附件失败'));
    } finally {
      setBindingAttachments(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', pendingImportFile);
      formData.append('allowPartial', allowPartialImport ? 'true' : 'false');
      const res = await apiClient.post('/contracts/import/csv', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const summary = res.data as {
        total: number;
        success: number;
        failed: number;
        errors: Array<{ row: number; message: string }>;
      };
      await fetchImportHistory();
      if (summary.failed > 0) {
        const firstError = summary.errors[0];
        message.warning(
          `导入完成：成功 ${summary.success} 条，失败 ${summary.failed} 条。示例错误：第 ${firstError.row} 行 ${firstError.message}`,
          5,
        );
        setImportPreview({
          total: summary.total,
          valid: summary.success,
          invalid: summary.failed,
          errors: summary.errors,
          samples: [],
        });
      } else {
        message.success(`导入成功：共 ${summary.success} 条`);
        setImportPreviewOpen(false);
        setImportPreview(null);
        setPendingImportFile(null);
        setAllowPartialImport(false);
      }
      await fetchContracts();
    } catch (error: unknown) {
      const errorPayload = error as { details?: { errors?: Array<{ row: number; message: string }> }; data?: { details?: { errors?: Array<{ row: number; message: string }> } } };
      const detailedErrors =
        (Array.isArray(errorPayload?.details?.errors) ? errorPayload.details.errors : undefined) ||
        (Array.isArray(errorPayload?.data?.details?.errors) ? errorPayload.data.details.errors : undefined) ||
        [];
      if (detailedErrors.length > 0 && importPreview) {
        setImportPreview({
          ...importPreview,
          errors: detailedErrors,
          invalid: detailedErrors.length,
        });
      }
      message.error(normalizeImportErrorMessage(error, '批量导入失败'));
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadHistoryErrorReport = async (record: ImportHistoryItem) => {
    try {
      const response = await apiClient.get(`/contracts/import/history/${record.id}/errors/excel`, {
        responseType: 'blob',
      });
      const xlsxBlob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(xlsxBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contracts-import-errors-${dayjs(record.createdAt).format('YYYYMMDDHHmmss')}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('错误报告下载成功');
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '下载错误报告失败'));
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          合同管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => router.push('/contracts/new')}>
          新增合同
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>批量上传（CSV/Excel）</Button>
            </Upload>
            <Button icon={<UploadOutlined />} onClick={handleOpenAttachmentBatch}>
              批量上传附件
            </Button>
            <Button onClick={() => setImportHistoryOpen(true)}>导入历史</Button>
            <Button onClick={handleDownloadImportTemplate}>下载Excel模板</Button>
            <Button onClick={handleExport} loading={exporting}>
              导出合同（Excel）
            </Button>
            <Button onClick={() => router.push('/settings/dictionaries?type=CONTRACT_TYPE')}>
              合同类型管理
            </Button>
            {isAdmin && (
              <Popconfirm
                title={`确定删除已选中的 ${selectedRowKeys.length} 条合同吗？`}
                description="删除后将不可恢复"
                onConfirm={handleBatchDeleteSelected}
                okText="确定"
                cancelText="取消"
                disabled={selectedRowKeys.length === 0}
              >
                <Button danger loading={batchDeleting} disabled={selectedRowKeys.length === 0}>
                  批量删除
                </Button>
              </Popconfirm>
            )}
            {isAdmin && selectedRowKeys.length > 0 && (
              <Text type="secondary">已选择 {selectedRowKeys.length} 条</Text>
            )}
          </Space>
        </div>
        <Space wrap>
          <Input
            placeholder="搜索合同名称、编号"
            prefix={<SearchOutlined />}
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            style={{ width: 230 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Input
            placeholder="对方签约主体（模糊搜索）"
            value={customerKeywordInput}
            onChange={(e) => setCustomerKeywordInput(e.target.value)}
            style={{ width: 220 }}
            allowClear
            onPressEnter={handleSearch}
          />
          <Select
            placeholder="签约年份"
            value={signYearInput}
            onChange={setSignYearInput}
            style={{ width: 140 }}
            allowClear
          >
            {yearOptions.map((year) => (
              <Option key={year} value={year}>
                {year}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="合同类型"
            value={contractTypeInput}
            onChange={setContractTypeInput}
            style={{ width: 150 }}
            allowClear
          >
            {contractTypes.map((type) => (
              <Option key={type.code} value={type.code}>
                {type.name}
              </Option>
            ))}
          </Select>
          <DatePicker
            placeholder="签署开始日期"
            value={startDateInput}
            onChange={setStartDateInput}
          />
          <DatePicker
            placeholder="签署结束日期"
            value={endDateInput}
            onChange={setEndDateInput}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </Space>
      </Card>

      <ContractsTable
        data={contracts}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        isAdmin={isAdmin}
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        onPageChange={(nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        }}
        onView={(contractId) => router.push(`/contracts/${contractId}`)}
        onEdit={(contractId) => router.push(`/contracts/${contractId}/edit`)}
        onDelete={handleDeleteOne}
        getContractTypeInfo={getContractTypeInfo}
      />

      <ContractImportPreviewModal
        open={importPreviewOpen}
        importing={importing}
        importPreview={importPreview}
        allowPartialImport={allowPartialImport}
        onAllowPartialImportChange={setAllowPartialImport}
        onCancel={() => {
          if (importing) return;
          setImportPreviewOpen(false);
          setImportPreview(null);
          setPendingImportFile(null);
          setAllowPartialImport(false);
        }}
        onConfirm={handleConfirmImport}
        onDownloadErrorReport={handleDownloadImportErrorReport}
      />

      <ContractAttachmentBatchModal
        open={attachmentBatchOpen}
        bindingAttachments={bindingAttachments}
        attachmentAllowOverwrite={attachmentAllowOverwrite}
        attachmentBatchFilesCount={attachmentBatchFiles.length}
        attachmentBatchUploadProps={attachmentBatchUploadProps}
        attachmentBatchResult={attachmentBatchResult}
        onCancel={() => {
          if (bindingAttachments) return;
          setAttachmentBatchOpen(false);
          resetAttachmentBatchState();
        }}
        onConfirm={handleConfirmAttachmentBatch}
        onAttachmentAllowOverwriteChange={setAttachmentAllowOverwrite}
      />

      <ContractImportHistoryModal
        open={importHistoryOpen}
        loading={importHistoryLoading}
        data={importHistory}
        onClose={() => setImportHistoryOpen(false)}
        onClear={clearImportHistory}
        onDownloadErrorReport={handleDownloadHistoryErrorReport}
      />
    </div>
  );
}
