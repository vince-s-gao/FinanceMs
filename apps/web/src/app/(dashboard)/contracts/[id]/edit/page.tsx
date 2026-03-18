'use client';

// InfFinanceMs - 合同编辑页面

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Space,
  Typography,
  Spin,
  message,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
  };
  amountWithTax: number;
  amountWithoutTax: number;
  taxRate: number;
  status: string;
  signDate: string;
  startDate?: string;
  endDate?: string;
  remark?: string;
}

interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

export default function ContractEditPage() {
  const params = useParams();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  const contractId = params.id as string;

  // 加载客户选项
  const fetchCustomers = async () => {
    try {
      const res = await api.get<CustomerOption[]>('/customers/options');
      setCustomers(res);
    } catch (error) {
      console.error('加载客户列表失败', error);
    }
  };

  // 加载合同详情
  const fetchContract = async () => {
    setLoading(true);
    try {
      const res = await api.get<Contract>(`/contracts/${contractId}`);
      setContract(res);
      // 设置表单值
      form.setFieldsValue({
        ...res,
        customerId: res.customer?.id || res.customerId,
        signDate: res.signDate ? dayjs(res.signDate) : null,
        startDate: res.startDate ? dayjs(res.startDate) : null,
        endDate: res.endDate ? dayjs(res.endDate) : null,
      });
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      // 格式化日期
      const data = {
        ...values,
        signDate: values.signDate?.format('YYYY-MM-DD'),
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      };

      await api.patch(`/contracts/${contractId}`, data);
      message.success('保存成功');
      router.push(`/contracts/${contractId}`);
    } catch (error: any) {
      message.error(error.message || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 计算不含税金额
  const handleAmountChange = () => {
    const amountWithTax = form.getFieldValue('amountWithTax');
    const taxRate = form.getFieldValue('taxRate');
    if (amountWithTax && taxRate) {
      const amountWithoutTax = amountWithTax / (1 + taxRate / 100);
      form.setFieldsValue({ amountWithoutTax: Math.round(amountWithoutTax * 100) / 100 });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      {/* 页面头部 */}
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push(`/contracts/${contractId}`)}
          >
            返回
          </Button>
          <Title level={4} className="!mb-0">
            编辑合同
          </Title>
        </Space>
        <Space>
          <Button onClick={() => router.push(`/contracts/${contractId}`)}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={submitting}
            onClick={handleSubmit}
          >
            保存
          </Button>
        </Space>
      </div>

      {/* 表单 */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 800 }}
        >
          <Form.Item
            name="contractNo"
            label="合同编号"
          >
            <Input disabled />
          </Form.Item>

          <Form.Item
            name="name"
            label="合同名称"
            rules={[{ required: true, message: '请输入合同名称' }]}
          >
            <Input placeholder="请输入合同名称" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="客户"
            rules={[{ required: true, message: '请选择客户' }]}
          >
            <Select placeholder="请选择客户" showSearch optionFilterProp="children">
              {customers.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="合同状态"
            rules={[{ required: true, message: '请选择合同状态' }]}
          >
            <Select placeholder="请选择合同状态">
              <Option value="DRAFT">草稿</Option>
              <Option value="EXECUTING">执行中</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="TERMINATED">已终止</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="amountWithTax"
            label="含税金额"
            rules={[{ required: true, message: '请输入含税金额' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              placeholder="请输入含税金额"
              onChange={handleAmountChange}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/,/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="taxRate"
            label="税率 (%)"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              max={100}
              precision={2}
              placeholder="请输入税率"
              onChange={handleAmountChange}
            />
          </Form.Item>

          <Form.Item
            name="amountWithoutTax"
            label="不含税金额"
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              precision={2}
              disabled
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value!.replace(/,/g, '') as any}
            />
          </Form.Item>

          <Form.Item
            name="signDate"
            label="签订日期"
            rules={[{ required: true, message: '请选择签订日期' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="开始日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="结束日期"
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="remark"
            label="备注"
          >
            <TextArea rows={4} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
