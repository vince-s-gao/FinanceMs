import { Button, Popconfirm, Space, Table, Tag, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, formatAmount, formatDate } from '@/lib/constants';
import type { ColumnsType } from 'antd/es/table';
import type { Contract } from './types';

const { Text } = Typography;

interface ContractsTableProps {
  data: Contract[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  isAdmin: boolean;
  selectedRowKeys: string[];
  onSelectedRowKeysChange: (keys: string[]) => void;
  onPageChange: (page: number, pageSize: number) => void;
  onView: (contractId: string) => void;
  onEdit: (contractId: string) => void;
  onDelete: (contractId: string) => Promise<void>;
  getContractTypeInfo: (code?: string | null) => { name: string; color: string };
}

export default function ContractsTable({
  data,
  loading,
  total,
  page,
  pageSize,
  isAdmin,
  selectedRowKeys,
  onSelectedRowKeysChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  getContractTypeInfo,
}: ContractsTableProps) {
  const columns: ColumnsType<Contract> = [
    {
      title: '合同编号',
      dataIndex: 'contractNo',
      key: 'contractNo',
      width: 150,
      render: (value: string, record) => <a onClick={() => onView(record.id)}>{value}</a>,
    },
    {
      title: '签约年份',
      key: 'signYear',
      width: 100,
      render: (_, record) => dayjs(record.signDate).year(),
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
      render: (value?: string | null) => value || '-',
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
      render: (value: number) => <Text strong>¥{formatAmount(value)}</Text>,
    },
    {
      title: '签署日期',
      dataIndex: 'signDate',
      key: 'signDate',
      width: 120,
      render: (value: string) => formatDate(value),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (value?: string | null) => (value ? formatDate(value) : '-'),
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
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => onView(record.id)}>
            查看
          </Button>
          {isAdmin && (
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
              编辑
            </Button>
          )}
          {isAdmin && (
            <Popconfirm
              title="确定删除该合同吗？"
              description="删除后将不可恢复"
              onConfirm={() => onDelete(record.id)}
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
    <Table
      columns={columns}
      dataSource={data}
      rowKey="id"
      rowSelection={
        isAdmin
          ? {
              selectedRowKeys,
              onChange: (keys) => onSelectedRowKeysChange(keys as string[]),
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
        showTotal: (count) => `共 ${count} 条`,
        onChange: onPageChange,
      }}
      scroll={{ x: 1900 }}
    />
  );
}
