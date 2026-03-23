"use client";

// InfFinanceMs - 客户管理页面

import { useCallback, useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  message,
  Popconfirm,
  Typography,
  Card,
  Descriptions,
  Spin,
  Upload,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import {
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
} from "@/lib/constants";
import { useExport } from "@/hooks/useExport";
import { useEntityDelete } from "@/hooks/useEntityDelete";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useImportUpload } from "@/hooks/useImportUpload";
import { getErrorMessage } from "@/lib/error";

const { Title } = Typography;
const { Option } = Select;

// 客户类型字典项接口
interface DictionaryItem {
  id: string;
  code: string;
  name: string;
  color?: string;
  isDefault?: boolean;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  type: string;
  creditCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  remark?: string;
  approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalRemark?: string;
  _count?: {
    contracts: number;
  };
}

interface CustomerDetail extends Customer {
  contracts?: Array<{
    id: string;
    contractNo: string;
    name: string;
    signDate?: string;
    status?: string;
  }>;
}

interface CustomerListResponse {
  items: Customer[];
  total: number;
}

export default function CustomersPage() {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  // 客户类型字典
  const [customerTypes, setCustomerTypes] = useState<DictionaryItem[]>([]);

  // 弹窗状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("新增客户");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<CustomerDetail | null>(null);
  const { exporting, handleExport: triggerExport } = useExport(
    "/customers",
    "customers",
  );
  const { deleteOne, deleteBatch, batchDeleting } = useEntityDelete(
    "/customers",
    "客户",
  );

  // 加载客户类型字典
  const fetchCustomerTypes = useCallback(async () => {
    try {
      const res = await api.get<DictionaryItem[]>(
        "/dictionaries/by-type/CUSTOMER_TYPE",
      );
      setCustomerTypes(res);
    } catch (error) {
      console.error("加载客户类型失败", error);
      // 使用默认值
      setCustomerTypes([
        { id: "1", code: "ENTERPRISE", name: "企业", color: "blue" },
        { id: "2", code: "INDIVIDUAL", name: "个人", color: "green" },
      ]);
    }
  }, []);

  // 根据code获取客户类型信息
  const getCustomerType = (code: string) => {
    return (
      customerTypes.find((t) => t.code === code) || {
        code,
        name: code,
        color: "default",
      }
    );
  };

  // 加载客户列表
  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (typeFilter) params.type = typeFilter;

      const res = await api.get<CustomerListResponse>("/customers", { params });
      setCustomers(res.items);
      setTotal(res.total);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载失败"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedKeyword, typeFilter]);

  useEffect(() => {
    fetchCustomerTypes();
  }, [fetchCustomerTypes]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // 打开新增弹窗
  const handleAdd = () => {
    setModalTitle("新增客户");
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleExport = async () => {
    const params: Record<string, unknown> = {};
    if (keyword) params.keyword = keyword;
    if (typeFilter) params.type = typeFilter;
    await triggerExport(params);
  };
  const { importing, uploadProps } = useImportUpload({
    endpoint: "/customers/import",
    onImported: fetchCustomers,
  });

  // 打开编辑弹窗
  const handleEdit = (record: Customer) => {
    setModalTitle("编辑客户");
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      if (editingId) {
        await api.patch(`/customers/${editingId}`, values);
        message.success("更新成功");
      } else {
        await api.post("/customers", values);
        message.success("创建成功");
      }

      setModalVisible(false);
      fetchCustomers();
      setSelectedRowKeys([]);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "操作失败"));
    } finally {
      setSubmitting(false);
    }
  };

  // 删除客户
  const handleDelete = async (id: string) => {
    const success = await deleteOne(id);
    if (success) {
      setSelectedRowKeys((prev) => prev.filter((key) => key !== id));
      fetchCustomers();
    }
  };

  const handleBatchDelete = async () => {
    await deleteBatch(selectedRowKeys);
    setSelectedRowKeys([]);
    fetchCustomers();
  };

  const handleApprove = async (id: string, approved: boolean) => {
    try {
      await api.patch(`/customers/${id}/approve`, {
        approved,
        remark: approved ? undefined : "审批驳回",
      });
      message.success(approved ? "审批通过" : "已驳回");
      fetchCustomers();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "审批失败"));
    }
  };

  const handleView = async (id: string) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await api.get<CustomerDetail>(`/customers/${id}`);
      setDetailData(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载客户详情失败"));
      setDetailVisible(false);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: "客户编号",
      dataIndex: "code",
      key: "code",
      width: 120,
    },
    {
      title: "客户名称",
      dataIndex: "name",
      key: "name",
      width: 300,
      ellipsis: true,
    },
    {
      title: "客户类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => {
        const typeInfo = getCustomerType(type);
        return <Tag color={typeInfo.color || "default"}>{typeInfo.name}</Tag>;
      },
    },
    {
      title: "审批状态",
      dataIndex: "approvalStatus",
      key: "approvalStatus",
      width: 100,
      render: (status: string) => (
        <Tag color={APPROVAL_STATUS_COLORS[status] || "default"}>
          {APPROVAL_STATUS_LABELS[status] || "-"}
        </Tag>
      ),
    },
    {
      title: "联系人",
      dataIndex: "contactName",
      key: "contactName",
      width: 100,
    },
    {
      title: "联系电话",
      dataIndex: "contactPhone",
      key: "contactPhone",
      width: 130,
    },
    {
      title: "合同数",
      dataIndex: ["_count", "contracts"],
      key: "contracts",
      width: 80,
      render: (v: number) => v || 0,
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, record: Customer) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleView(record.id)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          {/* 待审批状态显示审批按钮 */}
          {record.approvalStatus === "PENDING" && (
            <>
              <Popconfirm
                title="确定通过该客户吗？"
                onConfirm={() => handleApprove(record.id, true)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" icon={<CheckOutlined />}>
                  通过
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确定驳回该客户吗？"
                onConfirm={() => handleApprove(record.id, false)}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                >
                  驳回
                </Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="确定删除该客户吗？"
            description="删除后数据将无法恢复"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">
          客户管理
        </Title>
        <Space>
          <Upload {...uploadProps}>
            <Button icon={<UploadOutlined />} loading={importing}>
              批量上传
            </Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExport}
            loading={exporting}
          >
            批量导出
          </Button>
          <Popconfirm
            title={`确定删除选中的 ${selectedRowKeys.length} 个客户吗？`}
            description="删除后数据将无法恢复"
            onConfirm={handleBatchDelete}
            okText="确定"
            cancelText="取消"
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={batchDeleting}
              disabled={selectedRowKeys.length === 0}
            >
              批量删除
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            新增客户
          </Button>
        </Space>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索客户名称/编号/联系人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="客户类型"
            value={typeFilter}
            onChange={(value) => {
              setPage(1);
              setTypeFilter(value);
            }}
            style={{ width: 120 }}
            allowClear
          >
            {customerTypes.map((type) => (
              <Option key={type.code} value={type.code}>
                {type.name}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={customers}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        loading={loading}
        scroll={{ x: 1220 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      {/* 客户详情弹窗 */}
      <Modal
        title="客户详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setDetailData(null);
        }}
        footer={null}
        width={760}
      >
        {detailLoading ? (
          <div className="py-8 flex justify-center">
            <Spin />
          </div>
        ) : detailData ? (
          <div className="space-y-4">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="客户编号">
                {detailData.code || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="客户名称">
                {detailData.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="客户类型">
                {getCustomerType(detailData.type).name ||
                  detailData.type ||
                  "-"}
              </Descriptions.Item>
              <Descriptions.Item label="审批状态">
                {APPROVAL_STATUS_LABELS[detailData.approvalStatus || ""] || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="联系人">
                {detailData.contactName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="联系电话">
                {detailData.contactPhone || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="联系邮箱">
                {detailData.contactEmail || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="统一社会信用代码">
                {detailData.creditCode || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="地址" span={2}>
                {detailData.address || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="备注" span={2}>
                {detailData.remark || "-"}
              </Descriptions.Item>
            </Descriptions>
            <Card
              size="small"
              title={`最近合同（${detailData._count?.contracts || 0}）`}
            >
              {(detailData.contracts || []).length === 0 ? (
                <div className="text-gray-500">暂无关联合同</div>
              ) : (
                <div className="space-y-2">
                  {(detailData.contracts || []).map((contract) => (
                    <div key={contract.id} className="text-sm">
                      {contract.contractNo} - {contract.name}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </Modal>

      {/* 新增/编辑弹窗 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="客户名称"
            rules={[{ required: true, message: "请输入客户名称" }]}
          >
            <Input placeholder="请输入客户名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="客户类型"
            rules={[{ required: true, message: "请选择客户类型" }]}
          >
            <Select placeholder="请选择客户类型">
              {customerTypes.map((type) => (
                <Option key={type.code} value={type.code}>
                  {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="creditCode"
            label="统一社会信用代码"
            rules={[
              {
                pattern: /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/,
                message: "请输入有效的统一社会信用代码",
              },
            ]}
          >
            <Input placeholder="请输入统一社会信用代码" />
          </Form.Item>

          <Form.Item name="contactName" label="联系人">
            <Input placeholder="请输入联系人姓名" />
          </Form.Item>

          <Form.Item
            name="contactPhone"
            label="联系电话"
            rules={[
              {
                pattern: /^1[3-9]\d{9}$/,
                message: "请输入有效的手机号",
              },
            ]}
          >
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            name="contactEmail"
            label="联系邮箱"
            rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
          >
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input.TextArea placeholder="请输入地址" rows={2} />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea placeholder="请输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
