'use client';

// InfFinanceMs - 合同管理页面

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  DatePicker,
  Upload,
  Modal,
  Alert,
  Checkbox,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  ReloadOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '@/lib/api';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, formatAmount, formatDate } from '@/lib/constants';
import type { UploadProps } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

interface DictionaryItem {
  id: string;
  code: string;
  name: string;
  color?: string;
}

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  customer: {
    id: string;
    name: string;
    code: string;
  };
  signingEntity?: string | null;
  contractType?: string | null;
  amountWithTax: number;
  status: string;
  signDate: string;
  endDate?: string | null;
}

interface SearchFilters {
  keyword?: string;
  customerKeyword?: string;
  signYear?: number;
  contractType?: string;
  startDate?: string;
  endDate?: string;
}

interface ImportPreviewResult {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
  samples: Array<{
    row: number;
    contractNo: string;
    name: string;
    customerName: string;
    contractType: string;
    amount: number;
    signDate: string;
  }>;
}

interface ImportHistoryItem {
  id: string;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  allowPartial: boolean;
  createdAt: string;
  errors: Array<{ row: number; message: string }>;
  operator?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

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

  const normalizeImportErrorMessage = (error: any, fallback: string) => {
    const rawMessage =
      error?.message ||
      (typeof error?.data?.message === 'string' ? error.data.message : '') ||
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

  const fetchContractTypes = async () => {
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
  };

  // 加载合同列表
  const fetchContracts = async () => {
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
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractTypes();
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [page, pageSize, filters]);

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
    try {
      const params: Record<string, string | number> = {};
      if (filters.keyword) params.keyword = filters.keyword;
      if (filters.customerKeyword) params.customerKeyword = filters.customerKeyword;
      if (filters.signYear) params.signYear = filters.signYear;
      if (filters.contractType) params.contractType = filters.contractType;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await apiClient.get('/contracts/export/excel', {
        params,
        responseType: 'blob',
      });

      const now = dayjs().format('YYYYMMDD');
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const link = document.createElement('a');
      const url = window.URL.createObjectURL(blob);
      link.href = url;
      link.download = `contracts-${now}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch (error: any) {
      message.error(error?.message || '导出失败');
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await api.delete(`/contracts/${id}`);
      message.success('删除成功');
      setSelectedRowKeys((prev) => prev.filter((key) => key !== id));
      await fetchContracts();
    } catch (error: any) {
      message.error(error?.message || '删除失败');
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.info('请先选择要删除的合同');
      return;
    }
    const results = await Promise.allSettled(selectedRowKeys.map((id) => api.delete(`/contracts/${id}`)));
    const success = results.filter((item) => item.status === 'fulfilled').length;
    const failed = results.length - success;
    if (success > 0) {
      message.success(`批量删除完成：成功 ${success} 条${failed ? `，失败 ${failed} 条` : ''}`);
    } else {
      message.error('批量删除失败');
    }
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
    } catch (error: any) {
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
    } catch (error: any) {
      message.error(error?.message || '加载导入历史失败');
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
    } catch (error: any) {
      message.error(error?.message || '清空导入历史失败');
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
      } catch (error: any) {
        message.error(normalizeImportErrorMessage(error, '导入预校验失败'));
        onError?.(error);
      }
    },
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
    } catch (error: any) {
      const detailedErrors =
        (Array.isArray(error?.details?.errors) ? error.details.errors : undefined) ||
        (Array.isArray(error?.data?.details?.errors) ? error.data.details.errors : undefined) ||
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
    } catch (error: any) {
      message.error(error?.message || '下载错误报告失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '合同编号',
      dataIndex: 'contractNo',
      key: 'contractNo',
      width: 150,
      render: (v: string, record: Contract) => (
        <a onClick={() => router.push(`/contracts/${record.id}`)}>{v}</a>
      ),
    },
    {
      title: '签约年份',
      key: 'signYear',
      width: 100,
      render: (_: unknown, record: Contract) => dayjs(record.signDate).year(),
    },
    {
      title: '合同名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      width: 260,
    },
    {
      title: '对方签约主体',
      dataIndex: ['customer', 'name'],
      key: 'customer',
      width: 220,
      ellipsis: true,
    },
    {
      title: '公司签约主体',
      dataIndex: 'signingEntity',
      key: 'signingEntity',
      width: 220,
      ellipsis: true,
      render: (v?: string | null) => v || '-',
    },
    {
      title: '合同类型',
      dataIndex: 'contractType',
      key: 'contractType',
      width: 120,
      render: (code?: string | null) => {
        const typeInfo = getContractTypeInfo(code);
        return <Tag color={typeInfo.color}>{typeInfo.name}</Tag>;
      },
    },
    {
      title: '合同金额',
      dataIndex: 'amountWithTax',
      key: 'amountWithTax',
      width: 140,
      render: (v: number) => <Text strong>¥{formatAmount(v)}</Text>,
    },
    {
      title: '签署日期',
      dataIndex: 'signDate',
      key: 'signDate',
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (v?: string | null) => (v ? formatDate(v) : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => <Tag color={CONTRACT_STATUS_COLORS[status]}>{CONTRACT_STATUS_LABELS[status]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: Contract) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/contracts/${record.id}`)}
          >
            查看
          </Button>
          {isAdmin && (
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => router.push(`/contracts/${record.id}/edit`)}
            >
              编辑
            </Button>
          )}
          {isAdmin && (
            <Popconfirm
              title="确定删除该合同吗？"
              description="删除后将不可恢复"
              onConfirm={() => handleDeleteOne(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

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
            <Button onClick={() => setImportHistoryOpen(true)}>导入历史</Button>
            <Button onClick={handleDownloadImportTemplate}>下载Excel模板</Button>
            <Button onClick={handleExport}>导出合同（Excel）</Button>
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
                <Button danger disabled={selectedRowKeys.length === 0}>
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

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={contracts}
        rowKey="id"
        rowSelection={
          isAdmin
            ? {
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys as string[]),
              }
            : undefined
        }
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
        scroll={{ x: 1900 }}
      />

      <Modal
        title="批量导入预校验结果"
        open={importPreviewOpen}
        width={980}
        styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
        onCancel={() => {
          if (importing) return;
          setImportPreviewOpen(false);
          setImportPreview(null);
          setPendingImportFile(null);
          setAllowPartialImport(false);
        }}
        onOk={handleConfirmImport}
        okText={importPreview?.invalid ? '导入有效行' : '确认导入'}
        cancelText="取消"
        okButtonProps={{
          disabled:
            !importPreview ||
            importPreview.valid === 0 ||
            (importPreview.invalid > 0 && !allowPartialImport),
        }}
        confirmLoading={importing}
      >
        {importPreview && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type={importPreview.invalid > 0 ? 'warning' : 'success'}
              message={`总计 ${importPreview.total} 行，可导入 ${importPreview.valid} 行，异常 ${importPreview.invalid} 行`}
              showIcon
            />
            {importPreview.invalid > 0 && (
              <Checkbox
                checked={allowPartialImport}
                onChange={(e) => setAllowPartialImport(e.target.checked)}
              >
                忽略错误并仅导入有效行
              </Checkbox>
            )}
            {importPreview.errors.length > 0 && (
              <>
                <Button size="small" onClick={handleDownloadImportErrorReport}>
                  下载错误报告
                </Button>
                <div className="max-h-56 overflow-auto border rounded px-3 py-2 bg-gray-50 text-sm">
                  {importPreview.errors.slice(0, 20).map((item, index) => (
                    <div key={`${item.row}-${index}`}>
                      第 {item.row} 行：{item.message}
                    </div>
                  ))}
                  {importPreview.errors.length > 20 && (
                    <div>仅展示前 20 条错误，请下载错误报告查看全部。</div>
                  )}
                </div>
              </>
            )}
            {importPreview.samples.length > 0 && (
              <Table
                size="small"
                rowKey="row"
                pagination={false}
                dataSource={importPreview.samples}
                scroll={{ x: 980 }}
                columns={[
                  { title: '行号', dataIndex: 'row', width: 70 },
                  { title: '合同编号', dataIndex: 'contractNo', width: 160 },
                  { title: '合同名称', dataIndex: 'name', width: 220, ellipsis: true },
                  { title: '对方签约主体', dataIndex: 'customerName', width: 220, ellipsis: true },
                  { title: '合同类型', dataIndex: 'contractType', width: 120 },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    width: 120,
                    render: (v: number) => `¥${formatAmount(v)}`,
                  },
                  { title: '签署日期', dataIndex: 'signDate', width: 120 },
                ]}
              />
            )}
          </Space>
        )}
      </Modal>

      <Modal
        title="导入历史（最近10次）"
        open={importHistoryOpen}
        onCancel={() => setImportHistoryOpen(false)}
        footer={[
          <Button key="clear" danger onClick={clearImportHistory}>
            清空历史
          </Button>,
          <Button key="close" type="primary" onClick={() => setImportHistoryOpen(false)}>
            关闭
          </Button>,
        ]}
        width={880}
      >
        <Table
          size="small"
          rowKey="id"
          loading={importHistoryLoading}
          pagination={false}
          dataSource={importHistory}
          locale={{ emptyText: '暂无导入历史' }}
          columns={[
            {
              title: '导入时间',
              dataIndex: 'createdAt',
              width: 170,
              render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
              title: '文件名',
              dataIndex: 'fileName',
              ellipsis: true,
            },
            {
              title: '总行',
              dataIndex: 'total',
              width: 70,
            },
            {
              title: '成功',
              dataIndex: 'success',
              width: 70,
            },
            {
              title: '失败',
              dataIndex: 'failed',
              width: 70,
            },
            {
              title: '操作',
              key: 'action',
              width: 130,
              render: (_: unknown, record: ImportHistoryItem) => (
                <Button
                  size="small"
                  disabled={!record.errors.length}
                  onClick={() => handleDownloadHistoryErrorReport(record)}
                >
                  下载错误报告
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
