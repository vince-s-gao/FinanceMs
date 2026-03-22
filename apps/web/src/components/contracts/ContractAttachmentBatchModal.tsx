import { Alert, Checkbox, Modal, Space, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd/es/upload/interface';
import type { BatchAttachmentBindResult } from './types';

interface ContractAttachmentBatchModalProps {
  open: boolean;
  bindingAttachments: boolean;
  attachmentAllowOverwrite: boolean;
  attachmentBatchFilesCount: number;
  attachmentBatchUploadProps: UploadProps;
  attachmentBatchResult: BatchAttachmentBindResult | null;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
  onAttachmentAllowOverwriteChange: (checked: boolean) => void;
}

export default function ContractAttachmentBatchModal({
  open,
  bindingAttachments,
  attachmentAllowOverwrite,
  attachmentBatchFilesCount,
  attachmentBatchUploadProps,
  attachmentBatchResult,
  onCancel,
  onConfirm,
  onAttachmentAllowOverwriteChange,
}: ContractAttachmentBatchModalProps) {
  return (
    <Modal
      title="批量上传合同附件"
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText="开始绑定"
      cancelText="取消"
      confirmLoading={bindingAttachments}
      okButtonProps={{ disabled: attachmentBatchFilesCount === 0 }}
      width={900}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="系统将按文件名中的合同编号自动匹配并绑定到对应合同（例如：TKFY-0024-202511-租赁合同.pdf）"
        />
        <Checkbox
          checked={attachmentAllowOverwrite}
          onChange={(event) => onAttachmentAllowOverwriteChange(event.target.checked)}
        >
          覆盖合同现有附件
        </Checkbox>
        <Upload.Dragger {...attachmentBatchUploadProps}>
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p>点击或拖拽文件到此区域上传</p>
          <p className="text-xs text-gray-500">支持 PDF、图片、Word；单文件最大 100MB</p>
        </Upload.Dragger>
        {attachmentBatchResult && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert
              type={attachmentBatchResult.failed > 0 ? 'warning' : 'success'}
              showIcon
              message={`总计 ${attachmentBatchResult.total} 个文件，成功绑定 ${attachmentBatchResult.success} 个，失败 ${attachmentBatchResult.failed} 个`}
            />
            {attachmentBatchResult.errors.length > 0 && (
              <div className="max-h-56 overflow-auto border rounded px-3 py-2 bg-gray-50 text-sm">
                {attachmentBatchResult.errors.map((item, index) => (
                  <div key={`${item.fileName}-${index}`}>
                    {item.fileName}：{item.message}
                  </div>
                ))}
              </div>
            )}
          </Space>
        )}
      </Space>
    </Modal>
  );
}
