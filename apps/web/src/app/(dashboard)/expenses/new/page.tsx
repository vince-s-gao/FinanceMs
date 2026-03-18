'use client';

// InfFinanceMs - 新增报销页面

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  InputNumber,
  Card,
  Table,
  Space,
  message,
  Typography,
  Switch,
  Popconfirm,
  Upload,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import { FEE_TYPE_LABELS } from '@/lib/constants';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface ExpenseDetail {
  key: string;
  description: string; // 内容描述
  occurDate: string; // 发生日期
  amount: number; // 报销金额
  feeType: string; // 费用类型
  hasInvoice: boolean;
  invoiceType?: string; // 发票类型
  invoiceNo?: string;
}

interface Contract {
  id: string;
  contractNo: string;
  name: string;
}

// 项目接口
interface Project {
  id: string;
  code: string;
  name: string;
}

// 报销类型字典项接口
interface ExpenseTypeOption {
  id: string;
  code: string;
  name: string;
  color?: string;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [details, setDetails] = useState<ExpenseDetail[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // 加载合同列表
  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const res = await api.get<any>('/contracts', { params: { pageSize: 100, status: 'EXECUTING' } });
        setContracts(res.items || []);
      } catch (error) {
        console.error('加载合同列表失败', error);
      }
    };
    fetchContracts();
  }, []);

  // 加载项目列表
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await api.get<any>('/projects', { params: { pageSize: 100, status: 'ACTIVE' } });
        setProjects(res.items || res || []);
      } catch (error) {
        console.error('加载项目列表失败', error);
      }
    };
    fetchProjects();
  }, []);

  // 添加明细行
  const handleAddDetail = () => {
    const newDetail: ExpenseDetail = {
      key: Date.now().toString(),
      description: '',
      occurDate: dayjs().format('YYYY-MM-DD'),
      amount: 0,
      feeType: 'OTHER',
      hasInvoice: true,
    };
    setDetails([...details, newDetail]);
  };

  // 文件上传配置
  const uploadProps: UploadProps = {
    onRemove: (file) => {
      const index = fileList.indexOf(file);
      const newFileList = fileList.slice();
      newFileList.splice(index, 1);
      setFileList(newFileList);
    },
    beforeUpload: (file) => {
      // 限制文件大小 10MB
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过10MB');
        return Upload.LIST_IGNORE;
      }
      setFileList([...fileList, file]);
      return false; // 阻止自动上传
    },
    fileList,
    multiple: true,
  };

  // 删除明细行
  const handleDeleteDetail = (key: string) => {
    setDetails(details.filter((d) => d.key !== key));
  };

  // 更新明细行
  const handleUpdateDetail = (key: string, field: string, value: any) => {
    setDetails(
      details.map((d) => (d.key === key ? { ...d, [field]: value } : d))
    );
  };

  // 计算总金额
  const totalAmount = details.reduce((sum, d) => sum + (d.amount || 0), 0);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (details.length === 0) {
        message.error('请至少添加一条报销明细');
        return;
      }

      // 验证明细
      for (const detail of details) {
        if (!detail.description || !detail.occurDate || !detail.amount) {
          message.error('请完善报销明细信息（内容描述、发生日期、金额必填）');
          return;
        }
        if (detail.amount <= 0) {
          message.error('报销金额必须大于0');
          return;
        }
      }

      setSubmitting(true);

      const payload = {
        projectId: values.projectId,
        contractId: values.contractId || undefined,
        reason: values.reason,
        details: details.map((d) => ({
          feeType: d.feeType,
          occurDate: d.occurDate,
          amount: d.amount,
          hasInvoice: d.hasInvoice,
          invoiceType: d.invoiceType,
          invoiceNo: d.invoiceNo,
          description: d.description,
        })),
      };

      await api.post('/expenses', payload);
      message.success('创建成功');
      router.push('/expenses');
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 明细表格列
  const detailColumns = [
    {
      title: '内容描述',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      render: (_: any, record: ExpenseDetail) => (
        <Input
          value={record.description}
          onChange={(e) => handleUpdateDetail(record.key, 'description', e.target.value)}
          placeholder="请输入费用内容描述"
        />
      ),
    },
    {
      title: '发生日期',
      dataIndex: 'occurDate',
      key: 'occurDate',
      width: 140,
      render: (_: any, record: ExpenseDetail) => (
        <DatePicker
          value={record.occurDate ? dayjs(record.occurDate) : null}
          onChange={(d) =>
            handleUpdateDetail(record.key, 'occurDate', d?.format('YYYY-MM-DD'))
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '报销金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (_: any, record: ExpenseDetail) => (
        <InputNumber
          value={record.amount}
          onChange={(v) => handleUpdateDetail(record.key, 'amount', v || 0)}
          min={0}
          precision={2}
          style={{ width: '100%' }}
          prefix="¥"
          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          parser={(value) => value!.replace(/[¥,]/g, '') as any}
        />
      ),
    },
    {
      title: '费用类型',
      dataIndex: 'feeType',
      key: 'feeType',
      width: 120,
      render: (_: any, record: ExpenseDetail) => (
        <Select
          value={record.feeType}
          onChange={(v) => handleUpdateDetail(record.key, 'feeType', v)}
          style={{ width: '100%' }}
        >
          {Object.entries(FEE_TYPE_LABELS).map(([k, v]) => (
            <Option key={k} value={k}>
              {v}
            </Option>
          ))}
        </Select>
      ),
    },
    {
      title: '有发票',
      dataIndex: 'hasInvoice',
      key: 'hasInvoice',
      width: 70,
      render: (_: any, record: ExpenseDetail) => (
        <Switch
          checked={record.hasInvoice}
          onChange={(v) => handleUpdateDetail(record.key, 'hasInvoice', v)}
          size="small"
        />
      ),
    },
    {
      title: '发票号',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 120,
      render: (_: any, record: ExpenseDetail) => (
        <Input
          value={record.invoiceNo}
          onChange={(e) => handleUpdateDetail(record.key, 'invoiceNo', e.target.value)}
          placeholder="发票号码"
          disabled={!record.hasInvoice}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 60,
      render: (_: any, record: ExpenseDetail) => (
      <Popconfirm
        title="确定删除该明细吗？"
        description="删除后该行数据将被移除"
        onConfirm={() => handleDeleteDetail(record.key)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="link" danger icon={<DeleteOutlined />} />
      </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center mb-4">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.back()}
          className="mr-4"
        >
          返回
        </Button>
        <Title level={4} className="!mb-0">
          新增报销
        </Title>
      </div>

      <Card className="mb-4" title="基本信息">
        <Form form={form} layout="vertical">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Form.Item
              name="projectId"
              label="关联项目"
              rules={[{ required: true, message: '请选择关联项目' }]}
            >
              <Select
                placeholder="请选择关联项目"
                showSearch
                optionFilterProp="children"
              >
                {projects.map((p) => (
                  <Option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="contractId" label="关联合同">
              <Select
                placeholder="请选择关联合同（可选）"
                allowClear
                showSearch
                optionFilterProp="children"
              >
                {contracts.map((c) => (
                  <Option key={c.id} value={c.id}>
                    {c.contractNo} - {c.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item label="报销总额">
              <InputNumber
                value={totalAmount}
                disabled
                precision={2}
                style={{ width: '100%' }}
                prefix="¥"
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => value!.replace(/[¥,]/g, '') as any}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="reason"
            label="报销事由"
            rules={[{ required: true, message: '请输入报销事由' }]}
          >
            <TextArea
              placeholder="请详细描述报销事由，如：2026年1月出差北京参加客户会议"
              rows={3}
              maxLength={500}
              showCount
            />
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="报销明细"
        extra={
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddDetail}>
            添加明细
          </Button>
        }
      >
        <Table
          columns={detailColumns}
          dataSource={details}
          rowKey="key"
          pagination={false}
          scroll={{ x: 900 }}
          locale={{ emptyText: '请点击"添加明细"按钮添加报销项目' }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}>
                  <strong>合计</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={1}>
                  <strong>¥{totalAmount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} colSpan={4} />
              </Table.Summary.Row>
            </Table.Summary>
          )}
        />
      </Card>

      {/* 附件上传 */}
      <Card className="mb-4" title="附件上传">
        <Upload {...uploadProps} listType="picture">
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
        <div className="mt-2 text-gray-500 text-sm">
          支持上传发票、收据、行程单等凭证，单个文件不超过10MB，支持jpg、png、pdf格式
        </div>
      </Card>

      <div className="mt-4 flex justify-end space-x-4">
        <Button onClick={() => router.back()}>取消</Button>
        <Button type="primary" onClick={handleSubmit} loading={submitting}>
          保存
        </Button>
      </div>
    </div>
  );
}
