import { Alert, Button, Checkbox, Modal, Space, Table } from 'antd';
import { formatAmount } from '@/lib/constants';
import type { ImportPreviewResult } from './types';

interface ContractImportPreviewModalProps {
  open: boolean;
  importing: boolean;
  importPreview: ImportPreviewResult | null;
  allowPartialImport: boolean;
  onAllowPartialImportChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onDownloadErrorReport: () => void;
}

export default function ContractImportPreviewModal({
  open,
  importing,
  importPreview,
  allowPartialImport,
  onAllowPartialImportChange,
  onCancel,
  onConfirm,
  onDownloadErrorReport,
}: ContractImportPreviewModalProps) {
  return (
    <Modal
      title="批量导入预校验结果"
      open={open}
      width={980}
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={importPreview?.invalid ? '导入有效行' : '确认导入'}
      cancelText="取消"
      okButtonProps={{
        disabled:
          !importPreview ||
          importPreview.valid === 0 ||
          (importPreview.invalid > 0 && !allowPartialImport),
      }}
      confirmLoading={importing}
    >
      {importPreview && (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            type={importPreview.invalid > 0 ? 'warning' : 'success'}
            message={`总计 ${importPreview.total} 行，可导入 ${importPreview.valid} 行，异常 ${importPreview.invalid} 行`}
            showIcon
          />
          {importPreview.invalid > 0 && (
            <Checkbox
              checked={allowPartialImport}
              onChange={(event) => onAllowPartialImportChange(event.target.checked)}
            >
              忽略错误并仅导入有效行
            </Checkbox>
          )}
          {importPreview.errors.length > 0 && (
            <>
              <Button size="small" onClick={onDownloadErrorReport}>
                下载错误报告
              </Button>
              <div className="max-h-56 overflow-auto border rounded px-3 py-2 bg-gray-50 text-sm">
                {importPreview.errors.slice(0, 20).map((item, index) => (
                  <div key={`${item.row}-${index}`}>
                    第 {item.row} 行：{item.message}
                  </div>
                ))}
                {importPreview.errors.length > 20 && <div>仅展示前 20 条错误，请下载错误报告查看全部。</div>}
              </div>
            </>
          )}
          {importPreview.samples.length > 0 && (
            <Table
              size="small"
              rowKey="row"
              pagination={false}
              dataSource={importPreview.samples}
              scroll={{ x: 980 }}
              columns={[
                { title: '行号', dataIndex: 'row', width: 70 },
                { title: '合同编号', dataIndex: 'contractNo', width: 160 },
                { title: '合同名称', dataIndex: 'name', width: 220, ellipsis: true },
                { title: '对方签约主体', dataIndex: 'customerName', width: 220, ellipsis: true },
                { title: '合同类型', dataIndex: 'contractType', width: 120 },
                {
                  title: '金额',
                  dataIndex: 'amount',
                  width: 120,
                  render: (value: number) => `¥${formatAmount(value)}`,
                },
                { title: '签署日期', dataIndex: 'signDate', width: 120 },
              ]}
            />
          )}
        </Space>
      )}
    </Modal>
  );
}
