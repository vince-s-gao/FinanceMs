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
  Upload,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, InboxOutlined } from '@ant-design/icons';
import apiClient, { api } from '@/lib/api';
import dayjs from 'dayjs';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

interface Contract {
  id: string;
  contractNo: string;
  name: string;
  customerId: string;
  customer: {
    id: string;
    name: string;
    code?: string;
  };
  amountWithTax: number;
  amountWithoutTax: number;
  taxRate: number;
  signingEntity?: string;
  contractType?: string;
  status: string;
  signDate: string;
  startDate?: string;
  endDate?: string;
  remark?: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

interface DictionaryItem {
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
  const [contractTypes, setContractTypes] = useState<DictionaryItem[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string } | null>(null);

  const mergeCurrentCustomerOption = (list: CustomerOption[], current?: Contract | null): CustomerOption[] => {
    const customer = current?.customer;
    if (!customer?.id || !customer?.name) return list;
    if (list.some((item) => item.id === customer.id)) return list;
    return [
      {
        id: customer.id,
        name: customer.name,
        code: customer.code || '',
      },
      ...list,
    ];
  };

  const contractId = params.id as string;

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

        const response = await apiClient.post('/upload?category=contracts', formData, {
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

  // 加载客户选项
  const fetchCustomers = async () => {
    try {
      const res = await api.get<CustomerOption[]>('/customers/options');
      setCustomers(mergeCurrentCustomerOption(res, contract));
    } catch (error) {
      console.error('加载客户列表失败', error);
    }
  };

  const fetchContractTypes = async () => {
    try {
      const res = await api.get<DictionaryItem[]>('/dictionaries/by-type/CONTRACT_TYPE');
      setContractTypes(res);
    } catch {
      setContractTypes([
        { id: '1', code: 'SALES', name: '销售合同' },
        { id: '2', code: 'PURCHASE', name: '采购合同' },
        { id: '3', code: 'SERVICE', name: '服务合同' },
        { id: '4', code: 'OTHER', name: '其他' },
      ]);
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
      if (res.attachmentUrl) {
        const attachmentName =
          res.attachmentName || res.attachmentUrl.split('/').pop() || '合同附件';
        setUploadedFile({
          url: res.attachmentUrl,
          filename: attachmentName,
        });
        setFileList([
          {
            uid: 'existing-contract-attachment',
            name: attachmentName,
            status: 'done',
          },
        ]);
      } else {
        setUploadedFile(null);
        setFileList([]);
      }
      setCustomers((prev) => mergeCurrentCustomerOption(prev, res));
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchContractTypes();
    if (contractId) {
      fetchContract();
    }
  }, [contractId]);

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const { status, ...rest } = values;

      // 格式化日期
      const data = {
        ...rest,
        signDate: rest.signDate?.format('YYYY-MM-DD'),
        startDate: rest.startDate?.format('YYYY-MM-DD'),
        endDate: rest.endDate?.format('YYYY-MM-DD'),
        ...(uploadedFile
          ? {
              attachmentUrl: uploadedFile.url,
              attachmentName: uploadedFile.filename,
            }
          : {}),
      };

      await api.patch(`/contracts/${contractId}`, data);
      if (status && contract?.status && status !== contract.status) {
        await api.patch(`/contracts/${contractId}/status`, { status });
      }
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
            rules={[{ required: true, message: '请输入合同编号' }]}
          >
            <Input placeholder="请输入合同编号（可自定义）" />
          </Form.Item>

          <Form.Item
            name="name"
            label="合同名称"
            rules={[{ required: true, message: '请输入合同名称' }]}
          >
            <Input placeholder="请输入合同名称" />
          </Form.Item>

          <Form.Item
            name="contractType"
            label="合同类型"
            rules={[{ required: true, message: '请选择合同类型' }]}
          >
            <Select placeholder="请选择合同类型">
              {contractTypes.map((type) => (
                <Option key={type.code} value={type.code}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="signingEntity"
            label="公司签约主体"
            rules={[{ required: true, message: '请输入公司签约主体' }]}
          >
            <Input placeholder="请输入公司签约主体" />
          </Form.Item>

          <Form.Item
            name="customerId"
            label="对方签约主体"
            rules={[{ required: true, message: '请选择对方签约主体' }]}
          >
            <Select placeholder="请选择对方签约主体" showSearch optionFilterProp="children">
              {customers.map((c) => (
                <Option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ''}
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

          <Form.Item
            label="合同附件"
            extra="支持 PDF、图片、Word 文档，文件大小不超过 100MB"
          >
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">上传后会覆盖当前合同附件</p>
            </Dragger>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
