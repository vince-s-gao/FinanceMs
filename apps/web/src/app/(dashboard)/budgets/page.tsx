'use client';

// InfFinanceMs - 预算管理页面

import { useCallback, useEffect, useState } from 'react';
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
  InputNumber,
  Progress,
  Popconfirm,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { FEE_TYPE_LABELS, formatAmount } from '@/lib/constants';

const { Title, Text } = Typography;
const { Option } = Select;

// 预算状态标签
const BUDGET_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '生效中',
  FROZEN: '已冻结',
  CLOSED: '已关闭',
};

// 预算状态颜色
const BUDGET_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'success',
  FROZEN: 'warning',
  CLOSED: 'default',
};

interface Budget {
  id: string;
  year: number;
  month?: number;
  department: string;
  feeType: string;
  budgetAmount: number;
  usedAmount: number;
  usageRate: number;
  remainingAmount: number;
  isOverBudget: boolean;
  status: string;
  remark?: string;
}

export default function BudgetsPage() {
  const [loading, setLoading] = useState(false);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();
  const [departments, setDepartments] = useState<string[]>([]);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('新增预算');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 汇总数据
  const [summary, setSummary] = useState<any>(null);

  // 加载预算列表
  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (yearFilter) params.year = yearFilter;
      if (departmentFilter) params.department = departmentFilter;

      const res = await api.get<any>('/budgets', { params });
      setBudgets(res.items);
      setTotal(res.total);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, yearFilter, departmentFilter]);

  // 加载部门列表
  const fetchDepartments = useCallback(async () => {
    try {
      const res = await api.get<string[]>('/budgets/departments');
      setDepartments(res);
    } catch (error) {
      console.error('加载部门列表失败', error);
    }
  }, []);

  // 加载汇总数据
  const fetchSummary = useCallback(async () => {
    if (!departmentFilter || !yearFilter) {
      setSummary(null);
      return;
    }
    try {
      const res = await api.get(`/budgets/summary/${yearFilter}/${departmentFilter}`);
      setSummary(res);
    } catch (error) {
      console.error('加载汇总失败', error);
    }
  }, [departmentFilter, yearFilter]);

  useEffect(() => {
    fetchBudgets();
    fetchDepartments();
  }, [fetchBudgets, fetchDepartments]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle('新增预算');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ year: new Date().getFullYear() });
    setModalVisible(true);
  };

  // 打开编辑弹窗
  const handleEdit = (record: Budget) => {
    setModalTitle('编辑预算');
    setEditingId(record.id);
    form.setFieldsValue({
      budgetAmount: record.budgetAmount,
      remark: record.remark,
    });
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingId) {
        await api.patch(`/budgets/${editingId}`, {
          budgetAmount: values.budgetAmount,
          remark: values.remark,
        });
        message.success('更新成功');
      } else {
        await api.post('/budgets', values);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchBudgets();
      fetchSummary();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 冻结/解冻
  const handleToggleFreeze = async (id: string) => {
    try {
      await api.patch(`/budgets/${id}/freeze`);
      message.success('操作成功');
      fetchBudgets();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 关闭预算
  const handleClose = async (id: string) => {
    try {
      await api.patch(`/budgets/${id}/close`);
      message.success('已关闭');
      fetchBudgets();
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 删除预算
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/budgets/${id}`);
      message.success('删除成功');
      fetchBudgets();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '年度',
      dataIndex: 'year',
      key: 'year',
      width: 80,
    },
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 80,
      render: (v: number) => (v ? `${v}月` : '全年'),
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 100,
      render: (v: string) => FEE_TYPE_LABELS[v] || v,
    },
    {
      title: '预算金额',
      dataIndex: 'budgetAmount',
      key: 'budgetAmount',
      width: 120,
      render: (v: number) => `¥${formatAmount(v)}`,
    },
    {
      title: '已使用',
      dataIndex: 'usedAmount',
      key: 'usedAmount',
      width: 120,
      render: (v: number, record: Budget) => (
        <Text type={record.isOverBudget ? 'danger' : undefined}>
          ¥{formatAmount(v)}
        </Text>
      ),
    },
    {
      title: '使用率',
      key: 'usageRate',
      width: 150,
      render: (_: any, record: Budget) => (
        <Progress
          percent={Math.min(record.usageRate, 100)}
          size="small"
          status={record.isOverBudget ? 'exception' : record.usageRate > 80 ? 'active' : 'normal'}
          format={() => `${record.usageRate}%`}
        />
      ),
    },
    {
      title: '剩余',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      width: 120,
      render: (v: number, record: Budget) => (
        <Text type={record.isOverBudget ? 'danger' : 'success'}>
          ¥{formatAmount(v)}
        </Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => (
        <Tag color={BUDGET_STATUS_COLORS[status]}>
          {BUDGET_STATUS_LABELS[status]}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Budget) => (
        <Space size="small">
          {record.status === 'ACTIVE' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确定冻结该预算吗？"
                onConfirm={() => handleToggleFreeze(record.id)}
              >
                <Button type="link" size="small" icon={<LockOutlined />}>
                  冻结
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'FROZEN' && (
            <Button
              type="link"
              size="small"
              icon={<UnlockOutlined />}
              onClick={() => handleToggleFreeze(record.id)}
            >
              解冻
            </Button>
          )}
          {record.status !== 'CLOSED' && (
            <Popconfirm
              title="确定关闭该预算吗？关闭后不可恢复"
              onConfirm={() => handleClose(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                关闭
              </Button>
            </Popconfirm>
          )}
          {record.status === 'ACTIVE' && (
            <Popconfirm
              title="确定删除该预算吗？"
              description="删除后数据将无法恢复"
              onConfirm={() => handleDelete(record.id)}
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

  // 生成年份选项
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          预算管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增预算
        </Button>
      </div>

      {/* 汇总卡片 */}
      {summary && (
        <Card className="mb-4">
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="预算总额"
                value={summary.totalBudget}
                prefix="¥"
                precision={2}
                formatter={(value) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="已使用"
                value={summary.totalUsed}
                prefix="¥"
                precision={2}
                valueStyle={{ color: summary.totalUsed > summary.totalBudget ? '#ff4d4f' : '#1890ff' }}
                formatter={(value) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="剩余预算"
                value={summary.totalRemaining}
                prefix="¥"
                precision={2}
                valueStyle={{ color: summary.totalRemaining < 0 ? '#ff4d4f' : '#52c41a' }}
                formatter={(value) => value?.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="使用率"
                value={summary.usageRate}
                suffix="%"
                precision={2}
                valueStyle={{ color: summary.usageRate > 100 ? '#ff4d4f' : summary.usageRate > 80 ? '#faad14' : '#52c41a' }}
              />
            </Col>
          </Row>
        </Card>
      )}

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Select
            value={yearFilter}
            onChange={setYearFilter}
            style={{ width: 100 }}
          >
            {yearOptions.map((y) => (
              <Option key={y} value={y}>
                {y}年
              </Option>
            ))}
          </Select>
          <Select
            placeholder="选择部门"
            value={departmentFilter}
            onChange={setDepartmentFilter}
            style={{ width: 150 }}
            allowClear
          >
            {departments.map((d) => (
              <Option key={d} value={d}>
                {d}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={budgets}
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
        scroll={{ x: 1300 }}
        rowClassName={(record) => (record.isOverBudget ? 'bg-red-50' : '')}
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={form} layout="vertical" className="mt-4">
          {!editingId && (
            <>
              <Form.Item
                name="year"
                label="预算年度"
                rules={[{ required: true, message: '请选择年度' }]}
              >
                <Select>
                  {yearOptions.map((y) => (
                    <Option key={y} value={y}>
                      {y}年
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item name="month" label="预算月份">
                <Select placeholder="留空表示年度预算" allowClear>
                  {Array.from({ length: 12 }, (_, i) => (
                    <Option key={i + 1} value={i + 1}>
                      {i + 1}月
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="department"
                label="部门"
                rules={[{ required: true, message: '请输入部门' }]}
              >
                <Input placeholder="请输入部门名称" />
              </Form.Item>

              <Form.Item
                name="feeType"
                label="费用类型"
                rules={[{ required: true, message: '请选择费用类型' }]}
              >
                <Select placeholder="请选择费用类型">
                  {Object.entries(FEE_TYPE_LABELS).map(([k, v]) => (
                    <Option key={k} value={k}>
                      {v}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </>
          )}

          <Form.Item
            name="budgetAmount"
            label="预算金额"
            rules={[{ required: true, message: '请输入预算金额' }]}
          >
            <InputNumber
              placeholder="请输入预算金额"
              min={0}
              precision={2}
              style={{ width: '100%' }}
              prefix="¥"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/[¥,]/g, '') as any}
            />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
