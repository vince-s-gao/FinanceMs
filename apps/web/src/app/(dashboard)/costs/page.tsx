'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  Button,
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
  Input,
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { api } from '@/lib/api';
import { COST_SOURCE_LABELS, FEE_TYPE_LABELS, formatAmount, formatDate } from '@/lib/constants';
import { getErrorMessage } from '@/lib/error';
import type { ContractOption, CostItem, PaginatedData, ProjectOption } from '@inffinancems/shared';

const { Title, Text } = Typography;
const { Option } = Select;

interface CreateCostFormData {
  feeType: string;
  amount: number;
  occurDate: dayjs.Dayjs;
  projectId: string;
  contractId?: string;
  description?: string;
}

export default function CostsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [feeTypeFilter, setFeeTypeFilter] = useState<string | undefined>();
  const [sourceFilter, setSourceFilter] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm<CreateCostFormData>();
  const queryClient = useQueryClient();

  const costsQuery = useQuery({
    queryKey: ['costs', page, pageSize, feeTypeFilter, sourceFilter],
    queryFn: () =>
      api.get<PaginatedData<CostItem>>('/costs', {
        params: {
          page,
          pageSize,
          feeType: feeTypeFilter,
          source: sourceFilter,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const contractsQuery = useQuery({
    queryKey: ['contracts', 'options'],
    queryFn: () =>
      api.get<PaginatedData<ContractOption>>('/contracts', { params: { pageSize: 100 } }),
    enabled: modalVisible,
    staleTime: 5 * 60 * 1000,
  });

  const projectsQuery = useQuery({
    queryKey: ['projects', 'options'],
    queryFn: () =>
      api.get<PaginatedData<ProjectOption>>('/projects', {
        params: { pageSize: 100, status: 'ACTIVE' },
      }),
    enabled: modalVisible,
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/costs', payload),
    onSuccess: async () => {
      message.success('创建成功');
      setModalVisible(false);
      form.resetFields();
      await queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, '创建失败'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/costs/${id}`),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['costs'] });
      const queryKey = ['costs', page, pageSize, feeTypeFilter, sourceFilter] as const;
      const previous = queryClient.getQueryData<PaginatedData<CostItem>>(queryKey);
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
      message.error(getErrorMessage(error, '删除失败'));
    },
    onSuccess: () => {
      message.success('删除成功');
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['costs'] });
    },
  });

  useEffect(() => {
    if (!costsQuery.data) return;
    const hasNextPage = page * pageSize < costsQuery.data.total;
    if (!hasNextPage) return;

    queryClient.prefetchQuery({
      queryKey: ['costs', page + 1, pageSize, feeTypeFilter, sourceFilter],
      queryFn: () =>
        api.get<PaginatedData<CostItem>>('/costs', {
          params: {
            page: page + 1,
            pageSize,
            feeType: feeTypeFilter,
            source: sourceFilter,
          },
        }),
    });
  }, [costsQuery.data, feeTypeFilter, page, pageSize, queryClient, sourceFilter]);

  const handleAdd = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createMutation.mutateAsync({
        ...values,
        occurDate: values.occurDate.format('YYYY-MM-DD'),
      });
    } catch (error: unknown) {
      message.error(getErrorMessage(error));
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const columns = [
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 100,
      render: (v: string) => FEE_TYPE_LABELS[v],
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (v: number) => <Text strong>¥{formatAmount(v)}</Text>,
    },
    {
      title: '发生日期',
      dataIndex: 'occurDate',
      key: 'occurDate',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 100,
      render: (v: string) => (
        <Tag color={v === 'DIRECT' ? 'blue' : 'green'}>{COST_SOURCE_LABELS[v]}</Tag>
      ),
    },
    {
      title: '关联项目',
      key: 'project',
      width: 150,
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
          '-'
        ),
    },
    {
      title: '关联合同',
      key: 'contract',
      width: 180,
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
          '-'
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: CostItem) =>
        record.source === 'DIRECT' && (
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
        ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          费用管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          直接录入
        </Button>
      </div>

      <Card className="mb-4">
        <Space wrap>
          <Select
            placeholder="费用类型"
            value={feeTypeFilter}
            onChange={(v) => {
              setPage(1);
              setFeeTypeFilter(v);
            }}
            style={{ width: 120 }}
            allowClear
          >
            {Object.entries(FEE_TYPE_LABELS).map(([k, v]) => (
              <Option key={k} value={k}>
                {v}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="费用来源"
            value={sourceFilter}
            onChange={(v) => {
              setPage(1);
              setSourceFilter(v);
            }}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="DIRECT">直接录入</Option>
            <Option value="REIMBURSEMENT">报销生成</Option>
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={costsQuery.data?.items || []}
        rowKey="id"
        loading={costsQuery.isFetching}
        virtual
        scroll={{ y: 560, x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total: costsQuery.data?.total || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title="直接录入费用"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={createMutation.isPending}
        width={640}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="feeType" label="费用类型" rules={[{ required: true, message: '请选择费用类型' }]}>
            <Select placeholder="请选择费用类型">
              {Object.entries(FEE_TYPE_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>
                  {v}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="amount" label="金额" rules={[{ required: true, message: '请输入金额' }]}>
            <InputNumber style={{ width: '100%' }} min={0} precision={2} placeholder="请输入金额" />
          </Form.Item>

          <Form.Item
            name="occurDate"
            label="发生日期"
            rules={[{ required: true, message: '请选择发生日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="关联项目"
            rules={[{ required: true, message: '请选择关联项目' }]}
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
    </div>
  );
}
