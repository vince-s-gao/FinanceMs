import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, LinkOutlined, StopOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  INVOICE_DIRECTION_COLORS,
  INVOICE_DIRECTION_LABELS,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  formatAmount,
  formatDate,
} from '@/lib/constants';
import type { Invoice } from './types';

const { Text } = Typography;

interface InvoiceTableProps {
  dataSource: Invoice[];
  loading: boolean;
  current: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number, pageSize: number) => void;
  onVoid: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  resolveAttachmentUrl: (url?: string) => string;
  getTaxRateDisplay: (amount?: number, taxAmount?: number) => string;
}

export default function InvoiceTable({
  dataSource,
  loading,
  current,
  pageSize,
  total,
  onPageChange,
  onVoid,
  onDelete,
  resolveAttachmentUrl,
  getTaxRateDisplay,
}: InvoiceTableProps) {
  const columns: ColumnsType<Invoice> = [
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
      render: (_, record) => (
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
      render: (direction) => (
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
      render: (value: string) => INVOICE_TYPE_LABELS[value],
    },
    {
      title: '附件',
      key: 'attachment',
      width: 110,
      render: (_, record) =>
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
      render: (value: number) => <Text strong>¥{formatAmount(value)}</Text>,
    },
    {
      title: '税额',
      dataIndex: 'taxAmount',
      key: 'taxAmount',
      width: 100,
      render: (value?: number) => (value ? `¥${formatAmount(value)}` : '-'),
    },
    {
      title: '税率',
      key: 'taxRate',
      width: 90,
      render: (_, record) => getTaxRateDisplay(record.amount, record.taxAmount),
    },
    {
      title: '开票日期',
      dataIndex: 'invoiceDate',
      key: 'invoiceDate',
      width: 110,
      render: (value: string) => formatDate(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={INVOICE_STATUS_COLORS[status]}>{INVOICE_STATUS_LABELS[status]}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 170,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'ISSUED' ? (
            <Popconfirm
              title="确定作废该发票吗？"
              description="作废后该发票将无法恢复"
              onConfirm={() => onVoid(record.id)}
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
            onConfirm={() => onDelete(record.id)}
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
    <Table
      columns={columns}
      dataSource={dataSource}
      rowKey="id"
      loading={loading}
      pagination={{
        current,
        pageSize,
        total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (t) => `共 ${t} 条`,
        onChange: onPageChange,
      }}
      scroll={{ x: 1320 }}
    />
  );
}
