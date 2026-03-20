'use client';

// InfFinanceMs - 发票管理页面

import { useEffect, useMemo, useState } from 'react';
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
  Modal,
  Form,
  DatePicker,
  InputNumber,
  Popconfirm,
  Upload,
  Alert,
  Checkbox,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  StopOutlined,
  DeleteOutlined,
  UploadOutlined,
  LinkOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import apiClient, { api } from '@/lib/api';
import {
  INVOICE_DIRECTION_COLORS,
  INVOICE_DIRECTION_LABELS,
  INVOICE_TYPE_LABELS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_COLORS,
  formatAmount,
  formatDate,
} from '@/lib/constants';
import dayjs from 'dayjs';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { Title, Text } = Typography;
const { Option } = Select;

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number;
  invoiceDate: string;
  status: string;
  direction: 'INBOUND' | 'OUTBOUND';
  attachmentUrl?: string;
  attachmentName?: string;
  contract: {
    id: string;
    contractNo: string;
    name: string;
    customer: {
      id: string;
      name: string;
    };
  };
}

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  contractType?: string | null;
  customer?: {
    name?: string;
  };
}

interface InvoiceImportError {
  row: number;
  fileName: string;
  message: string;
}

interface InvoiceImportSample {
  row: number;
  fileName: string;
  contractNo: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number | null;
  invoiceDate: string;
}

interface InvoiceImportPreview {
  total: number;
  valid: number;
  invalid: number;
  errors: InvoiceImportError[];
  samples: InvoiceImportSample[];
}

type InvoiceDirection = 'INBOUND' | 'OUTBOUND';

interface InvoiceManagementPageProps {
  fixedDirection?: InvoiceDirection;
}

const INVOICE_PAGE_TITLE: Record<InvoiceDirection, string> = {
  INBOUND: '进项发票管理',
  OUTBOUND: '出项发票管理',
};

const INVOICE_CONTRACT_HINT: Record<InvoiceDirection, string> = {
  INBOUND: '仅可选择采购类合同',
  OUTBOUND: '仅可选择销售类合同',
};

export default function InvoiceManagementPage({ fixedDirection }: InvoiceManagementPageProps) {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [directionFilter, setDirectionFilter] = useState<InvoiceDirection | undefined>(fixedDirection);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string } | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFileList, setImportFileList] = useState<UploadFile[]>([]);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importContractId, setImportContractId] = useState<string | undefined>();
  const [importPreview, setImportPreview] = useState<InvoiceImportPreview | null>(null);
  const [allowPartialImport, setAllowPartialImport] = useState(false);
  const [previewingImport, setPreviewingImport] = useState(false);
  const [confirmingImport, setConfirmingImport] = useState(false);
  const [contractSearching, setContractSearching] = useState(false);

  const resolveDirectionByContractType = (contractType?: string | null): InvoiceDirection => {
    const normalized = (contractType || '').trim().toUpperCase();
    return normalized.includes('SALES') || (contractType || '').includes('销售')
      ? 'OUTBOUND'
      : 'INBOUND';
  };

  const isContractMatchedDirection = (contract?: Contract): boolean => {
    if (!contract) return false;
    if (!fixedDirection) return true;
    return resolveDirectionByContractType(contract.contractType) === fixedDirection;
  };

  const resolveAttachmentUrl = (url?: string) => {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    const normalizedPath = url.startsWith('/') ? url : `/${url}`;

    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      try {
        const parsed = new URL(configured);
        return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
      } catch {
        // ignore invalid configured url
      }
    }

    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:3001${normalizedPath}`;
    }
    return `http://127.0.0.1:3001${normalizedPath}`;
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    maxCount: 1,
    fileList,
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx',
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const formData = new FormData();
        formData.append('file', file as File);

        const response = await apiClient.post('/upload?category=invoices', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        setUploadedFile({
          url: response.data.url,
          filename: response.data.originalName || response.data.filename,
        });

        onSuccess?.(response.data);
        message.success('附件上传成功');
      } catch (error: any) {
        onError?.(error);
        message.error(error.message || '附件上传失败');
      }
    },
    onChange(info) {
      setFileList(info.fileList);
    },
    onRemove() {
      setUploadedFile(null);
      return true;
    },
  };

  const importUploadProps: UploadProps = {
    multiple: true,
    accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx,.csv,.xlsx,.xls',
    fileList: importFileList,
    beforeUpload: () => false,
    onChange(info) {
      setImportFileList(info.fileList);
      const selected = info.fileList
        .map((item) => item.originFileObj)
        .filter(Boolean) as File[];
      setImportFiles(selected);
    },
    onRemove(file) {
      const nextList = importFileList.filter((item) => item.uid !== file.uid);
      setImportFileList(nextList);
      setImportFiles(nextList.map((item) => item.originFileObj).filter(Boolean) as File[]);
      return true;
    },
  };

  // 加载发票列表
  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;
      const effectiveDirection = fixedDirection || directionFilter;
      if (effectiveDirection) params.direction = effectiveDirection;

      const res = await api.get<any>('/invoices', { params });
      setInvoices(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载合同列表（用于下拉选择）
  const fetchContracts = async (searchKeyword?: string) => {
    setContractSearching(true);
    try {
      const keyword = (searchKeyword || '').trim();
      const res = await api.get<any>('/contracts', {
        params: {
          page: 1,
          pageSize: 100,
          keyword: keyword || undefined,
          sortBy: 'signDate',
          sortOrder: 'desc',
        },
      });
      const items: Contract[] = res.items || [];
      setContracts(
        fixedDirection
          ? items.filter((item) => resolveDirectionByContractType(item.contractType) === fixedDirection)
          : items,
      );
    } catch (error) {
      console.error('加载合同列表失败', error);
    } finally {
      setContractSearching(false);
    }
  };

  const resetImportState = () => {
    setImportFileList([]);
    setImportFiles([]);
    setImportContractId(undefined);
    setImportPreview(null);
    setAllowPartialImport(false);
    setPreviewingImport(false);
    setConfirmingImport(false);
  };

  const openImportModal = () => {
    fetchContracts('');
    resetImportState();
    setImportModalVisible(true);
  };

  const handlePreviewImport = async () => {
    if (!importFiles.length) {
      message.warning('请先选择要上传的发票文件');
      return;
    }
    if (!importContractId) {
      message.warning('请先选择关联合同');
      return;
    }

    setPreviewingImport(true);
    try {
      const formData = new FormData();
      formData.append('contractId', importContractId);
      if (fixedDirection) {
        formData.append('expectedDirection', fixedDirection);
      }
      importFiles.forEach((file) => formData.append('files', file));

      const response = await apiClient.post('/invoices/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportPreview(response.data as InvoiceImportPreview);
      if ((response.data as InvoiceImportPreview).invalid > 0) {
        setAllowPartialImport(false);
      }
    } catch (error: any) {
      message.error(error?.message || '解析预览失败');
    } finally {
      setPreviewingImport(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!importFiles.length) {
      message.warning('请先选择要上传的发票文件');
      return;
    }
    if (!importContractId) {
      message.warning('请先选择关联合同');
      return;
    }
    if (!importPreview) {
      message.warning('请先执行解析预览');
      return;
    }
    if (importPreview.invalid > 0 && !allowPartialImport) {
      message.warning('存在异常行，请勾选“忽略错误并仅导入有效行”后继续');
      return;
    }

    setConfirmingImport(true);
    try {
      const formData = new FormData();
      formData.append('contractId', importContractId);
      formData.append('allowPartial', allowPartialImport ? 'true' : 'false');
      if (fixedDirection) {
        formData.append('expectedDirection', fixedDirection);
      }
      importFiles.forEach((file) => formData.append('files', file));

      const response = await apiClient.post('/invoices/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const summary = response.data as {
        total: number;
        success: number;
        failed: number;
        errors: InvoiceImportError[];
      };

      if (summary.failed > 0) {
        setImportPreview({
          total: summary.total,
          valid: summary.success,
          invalid: summary.failed,
          errors: summary.errors || [],
          samples: [],
        });
        if (summary.success === 0) {
          message.error(`本次未导入成功数据：失败 ${summary.failed} 条，请根据错误修正后重试`);
        } else {
          message.warning(`导入完成：成功 ${summary.success} 条，失败 ${summary.failed} 条`);
        }
      } else {
        message.success(`导入成功：共 ${summary.success} 条`);
        setImportModalVisible(false);
        resetImportState();
      }
      await fetchInvoices();
    } catch (error: any) {
      const details =
        (Array.isArray(error?.details?.errors) ? error.details.errors : undefined) ||
        (Array.isArray(error?.data?.details?.errors) ? error.data.details.errors : undefined) ||
        [];
      if (details.length > 0 && importPreview) {
        setImportPreview({
          ...importPreview,
          errors: details,
          invalid: details.length,
        });
      }
      message.error(error?.message || '批量导入失败');
    } finally {
      setConfirmingImport(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, pageSize, keyword, statusFilter, directionFilter, fixedDirection]);

  useEffect(() => {
    if (fixedDirection) {
      setDirectionFilter(fixedDirection);
    }
  }, [fixedDirection]);

  // 打开新增弹窗
  const handleAdd = () => {
    fetchContracts('');
    form.resetFields();
    setFileList([]);
    setUploadedFile(null);
    setModalVisible(true);
  };

  const contractOptions = contracts.map((contract) => ({
    value: contract.id,
    label: `${contract.contractNo} - ${contract.name}${contract.customer?.name ? `（${contract.customer.name}）` : ''}`,
  }));

  const selectedNewInvoiceContractId = Form.useWatch('contractId', form);
  const selectedNewInvoiceContract = useMemo(
    () => contracts.find((item) => item.id === selectedNewInvoiceContractId),
    [contracts, selectedNewInvoiceContractId],
  );
  const selectedImportContract = useMemo(
    () => contracts.find((item) => item.id === importContractId),
    [contracts, importContractId],
  );

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const selectedContract = contracts.find((item) => item.id === values.contractId);
      if (fixedDirection && !isContractMatchedDirection(selectedContract)) {
        message.error(`当前模块仅支持${INVOICE_DIRECTION_LABELS[fixedDirection]}，请重新选择合同`);
        return;
      }
      setSubmitting(true);

      await api.post('/invoices', {
        ...values,
        invoiceDate: values.invoiceDate.format('YYYY-MM-DD'),
        attachmentUrl: uploadedFile?.url,
        attachmentName: uploadedFile?.filename,
        expectedDirection: fixedDirection,
      });
      message.success('创建成功');

      setModalVisible(false);
      fetchInvoices();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 作废发票
  const handleVoid = async (id: string) => {
    try {
      await api.patch(`/invoices/${id}/void`);
      message.success('作废成功');
      fetchInvoices();
    } catch (error: any) {
      message.error(error.message || '作废失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/invoices/${id}`);
      message.success('删除成功');
      fetchInvoices();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  const getTaxRateDisplay = (amount?: number, taxAmount?: number) => {
    if (amount === null || amount === undefined || amount <= 0) return '-';
    if (taxAmount === null || taxAmount === undefined || taxAmount < 0) return '-';
    const baseWithoutTax = amount - taxAmount;
    if (baseWithoutTax <= 0) return '-';
    const rate = (taxAmount / baseWithoutTax) * 100;
    if (!Number.isFinite(rate)) return '-';
    return `${rate.toFixed(2)}%`;
  };

  // 表格列定义
  const columns = [
    {
      title: '发票号码',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 150,
    },
    {
      title: '合同',
      key: 'contract',
      width: 200,
      ellipsis: true,
      render: (_: any, record: Invoice) => (
        <div>
          <div>{record.contract.contractNo}</div>
          <Text type="secondary" className="text-xs">
            {record.contract.name}
          </Text>
        </div>
      ),
    },
    {
      title: '客户',
      dataIndex: ['contract', 'customer', 'name'],
      key: 'customer',
      width: 150,
      ellipsis: true,
    },
    {
      title: '发票方向',
      dataIndex: 'direction',
      key: 'direction',
      width: 220,
      render: (direction: 'INBOUND' | 'OUTBOUND') => (
        <Tag color={INVOICE_DIRECTION_COLORS[direction]}>
          {INVOICE_DIRECTION_LABELS[direction] || direction}
        </Tag>
      ),
    },
    {
      title: '发票类型',
      dataIndex: 'invoiceType',
      key: 'invoiceType',
      width: 130,
      render: (v: string) => INVOICE_TYPE_LABELS[v],
    },
    {
      title: '附件',
      key: 'attachment',
      width: 110,
      render: (_: any, record: Invoice) =>
        record.attachmentUrl ? (
          <Button
            type="link"
            size="small"
            icon={<LinkOutlined />}
            href={resolveAttachmentUrl(record.attachmentUrl)}
            target="_blank"
          >
            查看附件
          </Button>
        ) : (
          '-'
        ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => (
        <Text strong>¥{formatAmount(v)}</Text>
      ),
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 100,
      render: (v: number) => (v ? `¥${formatAmount(v)}` : '-'),
    },
    {
      title: '税率',
      key: 'taxRate',
      width: 90,
      render: (_: any, record: Invoice) => getTaxRateDisplay(record.amount, record.taxAmount),
    },
    {
      title: '开票日期',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={INVOICE_STATUS_COLORS[status]}>
          {INVOICE_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_: any, record: Invoice) => (
        <Space size="small">
          {record.status === 'ISSUED' ? (
            <Popconfirm
              title="确定作废该发票吗？"
              description="作废后该发票将无法恢复"
              onConfirm={() => handleVoid(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                作废
              </Button>
            </Popconfirm>
          ) : null}
          <Popconfirm
            title="确定删除该发票吗？"
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
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          {fixedDirection ? INVOICE_PAGE_TITLE[fixedDirection] : '发票管理'}
        </Title>
        <Space>
          <Button icon={<FileSearchOutlined />} onClick={openImportModal}>
            上传发票并解析
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增发票
          </Button>
        </Space>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索发票号/合同编号"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="发票状态"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="ISSUED">已开具</Option>
            <Option value="VOIDED">已作废</Option>
          </Select>
          {!fixedDirection && (
            <Select
              placeholder="发票方向"
              value={directionFilter}
              onChange={(value) => setDirectionFilter(value)}
              style={{ width: 140 }}
              allowClear
            >
              <Option value="INBOUND">进项发票</Option>
              <Option value="OUTBOUND">出项发票</Option>
            </Select>
          )}
          {fixedDirection && (
            <Tag color={INVOICE_DIRECTION_COLORS[fixedDirection]}>
              当前模块：{INVOICE_DIRECTION_LABELS[fixedDirection]}（{INVOICE_CONTRACT_HINT[fixedDirection]}）
            </Tag>
          )}
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={invoices}
        rowKey="id"
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
        scroll={{ x: 1320 }}
      />

      {/* 新增弹窗 */}
      <Modal
        title="新增发票"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="contractId"
            label="关联合同"
            rules={[{ required: true, message: '请选择合同' }]}
          >
            <Select
              placeholder={fixedDirection ? INVOICE_CONTRACT_HINT[fixedDirection] : '请输入合同编号/合同名称/对方签约主体'}
              showSearch
              filterOption={false}
              onSearch={fetchContracts}
              notFoundContent={contractSearching ? '搜索中...' : '无匹配合同'}
              options={contractOptions}
            />
          </Form.Item>
          {selectedNewInvoiceContract && (
            <Form.Item label="发票方向">
              <Tag color={INVOICE_DIRECTION_COLORS[resolveDirectionByContractType(selectedNewInvoiceContract.contractType)]}>
                {INVOICE_DIRECTION_LABELS[resolveDirectionByContractType(selectedNewInvoiceContract.contractType)]}
              </Tag>
            </Form.Item>
          )}

          <Form.Item
            name="invoiceNo"
            label="发票号码"
            rules={[{ required: true, message: '请输入发票号码' }]}
          >
            <Input placeholder="请输入发票号码" />
          </Form.Item>

          <Form.Item
            name="invoiceType"
            label="发票类型"
            rules={[{ required: true, message: '请选择发票类型' }]}
          >
            <Select placeholder="请选择发票类型">
              <Option value="VAT_SPECIAL">增值税专用发票</Option>
              <Option value="VAT_NORMAL">增值税普通发票</Option>
              <Option value="RECEIPT">收据</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amount"
            label="发票金额"
            rules={[{ required: true, message: '请输入发票金额' }]}
          >
            <InputNumber
              placeholder="请输入发票金额"
              min={0.01}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/[¥,]/g, '') as any}
            />
          </Form.Item>

          <Form.Item name="taxAmount" label="税额">
            <InputNumber
              placeholder="请输入税额"
              min={0}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/[¥,]/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="invoiceDate"
            label="开票日期"
            rules={[{ required: true, message: '请选择开票日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="发票附件"
            extra="支持 PDF、图片、Word 文档，文件大小不超过 100MB"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />}>上传附件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="上传发票并解析"
        open={importModalVisible}
        width={980}
        onCancel={() => {
          if (previewingImport || confirmingImport) return;
          setImportModalVisible(false);
          resetImportState();
        }}
        onOk={handleConfirmImport}
        okText="确认导入"
        cancelText="取消"
        confirmLoading={confirmingImport}
        okButtonProps={{
          disabled: !importPreview,
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Select
            placeholder={fixedDirection ? INVOICE_CONTRACT_HINT[fixedDirection] : '请输入合同编号/合同名称/对方签约主体'}
            value={importContractId}
            onChange={(value) => {
              setImportContractId(value);
              setImportPreview(null);
              setAllowPartialImport(false);
            }}
            showSearch
            filterOption={false}
            onSearch={fetchContracts}
            notFoundContent={contractSearching ? '搜索中...' : '无匹配合同'}
            style={{ width: '100%' }}
            options={contractOptions}
          />
          {selectedImportContract && (
            <Alert
              type="info"
              showIcon
              message={`当前关联合同将按「${INVOICE_DIRECTION_LABELS[resolveDirectionByContractType(selectedImportContract.contractType)]}」处理`}
            />
          )}
          <Upload.Dragger {...importUploadProps}>
            <p className="ant-upload-drag-icon">
              <UploadOutlined />
            </p>
            <p>点击或拖拽发票文件到此区域上传</p>
            <p className="text-xs text-gray-500">
              支持 PDF、图片、Word、CSV、Excel；单文件最大 100MB
            </p>
          </Upload.Dragger>
          <Button
            icon={<FileSearchOutlined />}
            onClick={handlePreviewImport}
            loading={previewingImport}
          >
            解析预览
          </Button>

          {importPreview && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                type={importPreview.invalid > 0 ? 'warning' : 'success'}
                showIcon
                message={`总计 ${importPreview.total} 条，可导入 ${importPreview.valid} 条，异常 ${importPreview.invalid} 条`}
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
                <div className="max-h-48 overflow-auto border rounded px-3 py-2 bg-gray-50 text-sm">
                  {importPreview.errors.slice(0, 50).map((item, index) => (
                    <div key={`${item.fileName}-${item.row}-${index}`}>
                      {item.fileName} 第 {item.row} 行：{item.message}
                    </div>
                  ))}
                  {importPreview.errors.length > 50 && <div>仅展示前 50 条错误。</div>}
                </div>
              )}
              {importPreview.samples.length > 0 && (
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(row) => `${row.fileName}-${row.row}-${row.invoiceNo}`}
                  dataSource={importPreview.samples}
                  scroll={{ x: 980, y: 260 }}
                  columns={[
                    { title: '文件', dataIndex: 'fileName', width: 170, ellipsis: true },
                    { title: '行号', dataIndex: 'row', width: 70 },
                    { title: '发票号码', dataIndex: 'invoiceNo', width: 180 },
                    {
                      title: '发票类型',
                      dataIndex: 'invoiceType',
                      width: 140,
                      render: (value: string) => INVOICE_TYPE_LABELS[value] || value,
                    },
                    {
                      title: '金额',
                      dataIndex: 'amount',
                      width: 120,
                      render: (value: number) => `¥${formatAmount(value)}`,
                    },
                    {
                      title: '税额',
                      dataIndex: 'taxAmount',
                      width: 120,
                      render: (value?: number | null) =>
                        value === null || value === undefined ? '-' : `¥${formatAmount(value)}`,
                    },
                    { title: '开票日期', dataIndex: 'invoiceDate', width: 130 },
                  ]}
                />
              )}
            </Space>
          )}
        </Space>
      </Modal>
    </div>
  );
}
