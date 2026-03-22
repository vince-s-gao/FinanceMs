import { Button, Modal, Table } from 'antd';
import dayjs from 'dayjs';
import type { ImportHistoryItem } from './types';

interface ContractImportHistoryModalProps {
  open: boolean;
  loading: boolean;
  data: ImportHistoryItem[];
  onClose: () => void;
  onClear: () => Promise<void>;
  onDownloadErrorReport: (record: ImportHistoryItem) => Promise<void>;
}

export default function ContractImportHistoryModal({
  open,
  loading,
  data,
  onClose,
  onClear,
  onDownloadErrorReport,
}: ContractImportHistoryModalProps) {
  return (
    <Modal
      title="导入历史（最近10次）"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="clear" danger onClick={onClear}>
          清空历史
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={880}
    >
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={data}
        locale={{ emptyText: '暂无导入历史' }}
        columns={[
          {
            title: '导入时间',
            dataIndex: 'createdAt',
            width: 170,
            render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
          },
          {
            title: '文件名',
            dataIndex: 'fileName',
            ellipsis: true,
          },
          {
            title: '总行',
            dataIndex: 'total',
            width: 70,
          },
          {
            title: '成功',
            dataIndex: 'success',
            width: 70,
          },
          {
            title: '失败',
            dataIndex: 'failed',
            width: 70,
          },
          {
            title: '操作',
            key: 'action',
            width: 130,
            render: (_, record: ImportHistoryItem) => (
              <Button
                size="small"
                disabled={!record.errors.length}
                onClick={() => onDownloadErrorReport(record)}
              >
                下载错误报告
              </Button>
            ),
          },
        ]}
      />
    </Modal>
  );
}
