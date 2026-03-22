import { Alert, Button, Checkbox, Modal, Select, Space, Table, Upload } from 'antd';
import { FileSearchOutlined, UploadOutlined } from '@ant-design/icons';
import { INVOICE_DIRECTION_LABELS, INVOICE_TYPE_LABELS, formatAmount } from '@/lib/constants';
import type { UploadProps } from 'antd/es/upload/interface';
import {
  INVOICE_CONTRACT_HINT,
  type ContractOptionItem,
  type ContractSelectOption,
  type InvoiceDirection,
  type InvoiceImportPreview,
} from './types';
import { resolveDirectionByContractType } from './utils';

interface InvoiceImportModalProps {
  open: boolean;
  fixedDirection?: InvoiceDirection;
  contractOptions: ContractSelectOption[];
  selectedContract?: ContractOptionItem;
  selectedContractId?: string;
  contractSearching: boolean;
  importUploadProps: UploadProps;
  importPreview: InvoiceImportPreview | null;
  allowPartialImport: boolean;
  previewingImport: boolean;
  confirmingImport: boolean;
  onClose: () => void;
  onSearchContracts: (keyword?: string) => void;
  onSelectContract: (contractId?: string) => void;
  onPreviewImport: () => Promise<void>;
  onConfirmImport: () => Promise<void>;
  onChangeAllowPartialImport: (checked: boolean) => void;
}

export default function InvoiceImportModal({
  open,
  fixedDirection,
  contractOptions,
  selectedContract,
  selectedContractId,
  contractSearching,
  importUploadProps,
  importPreview,
  allowPartialImport,
  previewingImport,
  confirmingImport,
  onClose,
  onSearchContracts,
  onSelectContract,
  onPreviewImport,
  onConfirmImport,
  onChangeAllowPartialImport,
}: InvoiceImportModalProps) {
  return (
    <Modal
      title="上传发票并解析"
      open={open}
      width={980}
      onCancel={onClose}
      onOk={onConfirmImport}
      okText="确认导入"
      cancelText="取消"
      confirmLoading={confirmingImport}
      okButtonProps={{ disabled: !importPreview }}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Select
          placeholder={
            fixedDirection ? INVOICE_CONTRACT_HINT[fixedDirection] : '请输入合同编号/合同名称/对方签约主体'
          }
          value={selectedContractId}
          onChange={(value) => onSelectContract(value)}
          showSearch
          filterOption={false}
          onSearch={onSearchContracts}
          notFoundContent={contractSearching ? '搜索中...' : '无匹配合同'}
          style={{ width: '100%' }}
          options={contractOptions}
        />

        {selectedContract && (
          <Alert
            type="info"
            showIcon
            message={`当前关联合同将按「${INVOICE_DIRECTION_LABELS[resolveDirectionByContractType(selectedContract.contractType)]}」处理`}
          />
        )}

        <Upload.Dragger {...importUploadProps}>
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p>点击或拖拽发票文件到此区域上传</p>
          <p className="text-xs text-gray-500">支持 PDF、图片、Word、CSV、Excel；单文件最大 100MB</p>
        </Upload.Dragger>

        <Button icon={<FileSearchOutlined />} onClick={onPreviewImport} loading={previewingImport}>
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
                onChange={(event) => onChangeAllowPartialImport(event.target.checked)}
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
  );
}
