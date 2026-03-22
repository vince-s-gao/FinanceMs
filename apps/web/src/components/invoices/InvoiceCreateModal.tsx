import { Button, DatePicker, Form, Input, InputNumber, Modal, Select, Tag, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { UploadProps } from 'antd/es/upload/interface';
import { INVOICE_DIRECTION_COLORS, INVOICE_DIRECTION_LABELS } from '@/lib/constants';
import { INVOICE_CONTRACT_HINT, type ContractSelectOption, type InvoiceDirection, type InvoiceFormValues } from './types';

const { Option } = Select;

interface InvoiceCreateModalProps {
  open: boolean;
  submitting: boolean;
  form: FormInstance<InvoiceFormValues>;
  fixedDirection?: InvoiceDirection;
  contractSearching: boolean;
  contractOptions: ContractSelectOption[];
  selectedDirection?: InvoiceDirection;
  uploadProps: UploadProps;
  onSearchContracts: (keyword?: string) => void;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}

export default function InvoiceCreateModal({
  open,
  submitting,
  form,
  fixedDirection,
  contractSearching,
  contractOptions,
  selectedDirection,
  uploadProps,
  onSearchContracts,
  onCancel,
  onSubmit,
}: InvoiceCreateModalProps) {
  return (
    <Modal
      title="新增发票"
      open={open}
      onOk={onSubmit}
      onCancel={onCancel}
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
            placeholder={
              fixedDirection
                ? INVOICE_CONTRACT_HINT[fixedDirection]
                : '请输入合同编号/合同名称/对方签约主体'
            }
            showSearch
            filterOption={false}
            onSearch={onSearchContracts}
            notFoundContent={contractSearching ? '搜索中...' : '无匹配合同'}
            options={contractOptions}
          />
        </Form.Item>

        {selectedDirection && (
          <Form.Item label="发票方向">
            <Tag color={INVOICE_DIRECTION_COLORS[selectedDirection]}>
              {INVOICE_DIRECTION_LABELS[selectedDirection]}
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
          <InputNumber<number>
            placeholder="请输入发票金额"
            min={0.01}
            precision={2}
            style={{ width: '100%' }}
            prefix="¥"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number((value || '').replace(/[¥,]/g, ''))}
          />
        </Form.Item>

        <Form.Item name="taxAmount" label="税额">
          <InputNumber<number>
            placeholder="请输入税额"
            min={0}
            precision={2}
            style={{ width: '100%' }}
            prefix="¥"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => Number((value || '').replace(/[¥,]/g, ''))}
          />
        </Form.Item>

        <Form.Item
          name="invoiceDate"
          label="开票日期"
          rules={[{ required: true, message: '请选择开票日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="发票附件" extra="支持 PDF、图片、Word 文档，文件大小不超过 100MB">
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />}>上传附件</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
}
