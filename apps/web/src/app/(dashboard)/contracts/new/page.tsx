'use client';

// InfFinanceMs - 新增合同页面

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  message,
  Upload,
  Divider,
  Row,
  Col,
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { api } from '@/lib/api';
import apiClient from '@/lib/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;
const { Dragger } = Upload;

interface CustomerOption {
  id: string;
  code: string;
  name: string;
}

export default function ContractNewPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; filename: string } | null>(null);

  // 加载客户选项
  const fetchCustomers = async () => {
    try {
      const res = await api.get<CustomerOption[]>('/customers/options');
      setCustomers(res);
    } catch (error) {
      console.error('加载客户列表失败', error);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // 设置默认值
    form.setFieldsValue({
      status: 'DRAFT',
      productTaxRate: 13,
      serviceTaxRate: 6,
    });
  }, []);

  // 计算金额
  const calculateAmounts = () => {
    const productAmount = form.getFieldValue('productAmount') || 0;
    const productTaxRate = form.getFieldValue('productTaxRate') || 0;
    const serviceAmount = form.getFieldValue('serviceAmount') || 0;
    const serviceTaxRate = form.getFieldValue('serviceTaxRate') || 0;

    // 计算含税总金额
    const amountWithTax = productAmount + serviceAmount;

    // 计算不含税金额
    const productWithoutTax = productTaxRate > 0 ? productAmount / (1 + productTaxRate / 100) : productAmount;
    const serviceWithoutTax = serviceTaxRate > 0 ? serviceAmount / (1 + serviceTaxRate / 100) : serviceAmount;
    const amountWithoutTax = productWithoutTax + serviceWithoutTax;

    form.setFieldsValue({
      amountWithTax: Math.round(amountWithTax * 100) / 100,
      amountWithoutTax: Math.round(amountWithoutTax * 100) / 100,
    });
  };

  // 文件上传配置
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
          filename: response.data.originalName,
        });

        onSuccess?.(response.data);
        message.success('文件上传成功');
      } catch (error: any) {
        onError?.(error);
        message.error(error.message || '文件上传失败');
      }
    },
    onChange(info) {
      setFileList(info.fileList);
    },
    onRemove() {
      setUploadedFile(null);
    },
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 验证附件
      if (!uploadedFile) {
        message.error('请上传双章版合同扫描件');
        return;
      }

      setSubmitting(true);

      // 格式化日期和数据
      const data = {
        ...values,
        signDate: values.signDate?.format('YYYY-MM-DD'),
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
        attachmentUrl: uploadedFile.url,
        attachmentName: uploadedFile.filename,
      };

      const res = await api.post<{ id: string }>('/contracts', data);
      message.success('创建成功');
      router.push(`/contracts/${res.id}`);
    } catch (error: any) {
      message.error(error.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* 页面头部 */}
      <div className="flex justify-between items-center mb-4">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/contracts')}
          >
            返回
          </Button>
          <Title level={4} className="!mb-0">
            新增合同
          </Title>
        </Space>
        <Space>
          <Button onClick={() => router.push('/contracts')}>
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
      <Card title="基本信息" className="mb-4">
        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 900 }}
        >
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="合同名称"
                rules={[{ required: true, message: '请输入合同名称' }]}
              >
                <Input placeholder="请输入合同名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="status"
                label="合同状态"
                rules={[{ required: true, message: '请选择合同状态' }]}
              >
                <Select placeholder="请选择合同状态">
                  <Option value="DRAFT">草稿</Option>
                  <Option value="EXECUTING">执行中</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="signDate"
                label="签订日期"
                rules={[{ required: true, message: '请选择签订日期' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="startDate" label="开始日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="endDate" label="结束日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="金额信息" className="mb-4">
        <Form form={form} layout="vertical" style={{ maxWidth: 900 }}>
          <Divider orientation="left">产品部分</Divider>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="productAmount" label="产品含税金额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入产品含税金额"
                  onChange={calculateAmounts}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/,/g, '') as any}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="productTaxRate" label="产品税率 (%)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  precision={2}
                  placeholder="如：13"
                  onChange={calculateAmounts}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">服务部分</Divider>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item name="serviceAmount" label="服务含税金额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入服务含税金额"
                  onChange={calculateAmounts}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/,/g, '') as any}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serviceTaxRate" label="服务税率 (%)">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100}
                  precision={2}
                  placeholder="如：6"
                  onChange={calculateAmounts}
                />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">合计</Divider>
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                name="amountWithTax"
                label="含税总金额"
                rules={[{ required: true, message: '请填写金额信息' }]}
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
            </Col>
            <Col span={12}>
              <Form.Item name="amountWithoutTax" label="不含税总金额">
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  disabled
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/,/g, '') as any}
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="合同附件（必填）" className="mb-4">
        <Form form={form} layout="vertical">
          <Form.Item
            label="双章版合同扫描件"
            required
            extra="支持 PDF、图片、Word 文档，文件大小不超过 10MB"
          >
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                请上传双章版（甲乙双方盖章）的合同扫描件
              </p>
            </Dragger>
          </Form.Item>
        </Form>
      </Card>

      <Card title="备注信息">
        <Form form={form} layout="vertical" style={{ maxWidth: 900 }}>
          <Form.Item name="remark" label="备注">
            <TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
