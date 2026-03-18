'use client';

// InfFinanceMs - 付款申请详情页面
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  Button,
  Card,
  Descriptions,
  Tag,
  Space,
  Modal,
  Input,
  message,
  Typography,
  List,
  Divider,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  FileTextOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// 状态映射
const statusMap: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'default' },
  PENDING: { label: '待审批', color: 'processing' },
  APPROVED: { label: '已通过', color: 'success' },
  REJECTED: { label: '已拒绝', color: 'error' },
  PAID: { label: '已付款', color: 'cyan' },
  CANCELLED: { label: '已取消', color: 'default' },
};

// 付款方式映射
const paymentMethodMap: Record<string, string> = {
  TRANSFER: '银行转账',
  CASH: '现金',
  CHECK: '支票',
  DRAFT: '汇票',
  OTHER: '其他',
};

interface PaymentRequest {
  id: string;
  requestNo: string;
  reason: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  // 收款方信息已整合到 bankAccount 中
  attachments?: { name: string; url: string; size?: number }[];
  remark?: string;
  applicant: { id: string; name: string; email: string; phone?: string };
  // bankAccount 包含收款方完整信息
  bankAccount: {
    id: string;
    accountType?: string;   // 账户类型：PERSONAL/CORPORATE
    accountName: string;    // 户名
    accountNo: string;      // 账号
    bankName: string;       // 银行名称
    bankBranch?: string;    // 支行名称
  };
  approver?: { id: string; name: string; email: string };
  submitDate?: string;
  approvedAt?: string;
  approvalRemark?: string;
  createdAt: string;
}

export default function PaymentRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentRequest | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [approveAction, setApproveAction] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [approvalRemark, setApprovalRemark] = useState('');

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const result = await api.get<PaymentRequest>(`/payment-requests/${params.id}`);
      setData(result);
    } catch (error: any) {
      message.error(error.message || '加载数据失败');
      router.push('/payment-requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [params.id]);

  // 提交申请
  const handleSubmit = async () => {
    try {
      await api.post(`/payment-requests/${params.id}/submit`);
      message.success('提交成功');
      loadData();
    } catch (error: any) {
      message.error(error.message || '提交失败');
    }
  };

  // 审批
  const handleApprove = async () => {
    try {
      await api.post(`/payment-requests/${params.id}/approve`, {
        status: approveAction,
        approvalRemark,
      });
      message.success(approveAction === 'APPROVED' ? '审批通过' : '已拒绝');
      setApproveModalOpen(false);
      setApprovalRemark('');
      loadData();
    } catch (error: any) {
      message.error(error.message || '审批失败');
    }
  };

  // 确认付款
  const handleConfirmPayment = async () => {
    Modal.confirm({
      title: '确认付款',
      content: '确定要确认该付款申请已完成付款吗？',
      onOk: async () => {
        try {
          await api.post(`/payment-requests/${params.id}/confirm-payment`);
          message.success('已确认付款');
          loadData();
        } catch (error: any) {
          message.error(error.message || '操作失败');
        }
      },
    });
  };

  // 取消申请
  const handleCancel = async () => {
    Modal.confirm({
      title: '取消申请',
      content: '确定要取消该付款申请吗？',
      onOk: async () => {
        try {
          await api.post(`/payment-requests/${params.id}/cancel`);
          message.success('已取消');
          loadData();
        } catch (error: any) {
          message.error(error.message || '取消失败');
        }
      },
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">加载中...</div>;
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
          />
          <div>
            <Space>
              <Title level={4} style={{ margin: 0 }}>{data.requestNo}</Title>
              <Tag color={statusMap[data.status]?.color}>
                {statusMap[data.status]?.label}
              </Tag>
            </Space>
            <div>
              <Text type="secondary">{data.reason}</Text>
            </div>
          </div>
        </div>
        <Space>
          {data.status === 'DRAFT' && (
            <>
              <Button
                icon={<EditOutlined />}
                onClick={() => router.push(`/payment-requests/${data.id}/edit`)}
              >
                编辑
              </Button>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit}>
                提交
              </Button>
            </>
          )}
          {data.status === 'PENDING' && (
            <>
              <Button
                danger
                icon={<CloseOutlined />}
                onClick={() => {
                  setApproveAction('REJECTED');
                  setApproveModalOpen(true);
                }}
              >
                拒绝
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => {
                  setApproveAction('APPROVED');
                  setApproveModalOpen(true);
                }}
              >
                通过
              </Button>
              <Button onClick={handleCancel}>取消申请</Button>
            </>
          )}
          {data.status === 'APPROVED' && (
            <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirmPayment}>
              确认付款
            </Button>
          )}
        </Space>
      </div>

      {/* 基本信息 */}
      <Card title="申请详情">
        <Descriptions column={3}>
          <Descriptions.Item label="付款事由">{data.reason}</Descriptions.Item>
          <Descriptions.Item label="付款金额">
            <Text strong style={{ fontSize: 16 }}>
              {data.currency} {Number(data.amount).toLocaleString()}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="付款方式">
            {paymentMethodMap[data.paymentMethod]}
          </Descriptions.Item>
          <Descriptions.Item label="付款日期">
            {dayjs(data.paymentDate).format('YYYY-MM-DD')}
          </Descriptions.Item>
          <Descriptions.Item label="收款方账户" span={2}>
            {/* 收款方信息已整合到银行账户中 */}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{data.bankAccount.accountName}</span>
                {data.bankAccount.accountType && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded">
                    {data.bankAccount.accountType === 'PERSONAL' ? '个人' : '对公'}
                  </span>
                )}
              </div>
              <div className="text-gray-500">
                {data.bankAccount.bankName}
                {data.bankAccount.bankBranch && ` · ${data.bankAccount.bankBranch}`}
              </div>
              <div className="text-gray-400">{data.bankAccount.accountNo}</div>
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="申请人">
            <div>
              {data.applicant.name}
              <div>
                <Text type="secondary">{data.applicant.email}</Text>
              </div>
            </div>
          </Descriptions.Item>
        </Descriptions>

        {/* 备注 */}
        {data.remark && (
          <>
            <Divider />
            <Descriptions>
              <Descriptions.Item label="备注">{data.remark}</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Card>

      {/* 附件 */}
      {data.attachments && data.attachments.length > 0 && (
        <Card title="附件">
          <List
            dataSource={data.attachments}
            renderItem={(file) => (
              <List.Item
                actions={[
                  <Button
                    key="download"
                    type="link"
                    icon={<DownloadOutlined />}
                    href={file.url}
                    target="_blank"
                  >
                    下载
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                  title={file.name}
                />
              </List.Item>
            )}
          />
        </Card>
      )}

      {/* 审批信息 */}
      {data.approver && (
        <Card title="审批信息">
          <Descriptions column={3}>
            <Descriptions.Item label="审批人">{data.approver.name}</Descriptions.Item>
            <Descriptions.Item label="审批时间">
              {data.approvedAt && dayjs(data.approvedAt).format('YYYY-MM-DD HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="审批结果">
              <Tag color={statusMap[data.status]?.color}>
                {statusMap[data.status]?.label}
              </Tag>
            </Descriptions.Item>
            {data.approvalRemark && (
              <Descriptions.Item label="审批备注" span={3}>
                {data.approvalRemark}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* 审批对话框 */}
      <Modal
        title={approveAction === 'APPROVED' ? '审批通过' : '拒绝申请'}
        open={approveModalOpen}
        onOk={handleApprove}
        onCancel={() => {
          setApproveModalOpen(false);
          setApprovalRemark('');
        }}
        okText="确认"
        cancelText="取消"
        okButtonProps={{
          danger: approveAction === 'REJECTED',
        }}
      >
        <div className="py-4">
          <Text>审批备注（选填）</Text>
          <TextArea
            placeholder="请输入审批备注"
            value={approvalRemark}
            onChange={(e) => setApprovalRemark(e.target.value)}
            rows={3}
            className="mt-2"
          />
        </div>
      </Modal>
    </div>
  );
}
