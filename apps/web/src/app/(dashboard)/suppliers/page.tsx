"use client";

// InfFinanceMs - 供应商管理页面

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
  UploadOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { api } from "@/lib/api";
import { useExport } from "@/hooks/useExport";
import { useEntityDelete } from "@/hooks/useEntityDelete";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useImportUpload } from "@/hooks/useImportUpload";
import { getErrorMessage } from "@/lib/error";

const { Title } = Typography;
const { Option } = Select;

interface DictionaryItem {
  id: string;
  code: string;
  name: string;
  color?: string;
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  type: string;
  contractCount?: number;
  creditCode?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNo?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SupplierListResponse {
  items: Supplier[];
  total: number;
}

export default function SuppliersPage() {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState("");
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [typeFilter, setTypeFilter] = useState<string | undefined>();

  const [supplierTypes, setSupplierTypes] = useState<DictionaryItem[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("新增供应商");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const { exporting, handleExport: triggerExport } = useExport(
    "/suppliers",
    "suppliers",
  );
  const { deleteOne, deleteBatch, batchDeleting } = useEntityDelete(
    "/suppliers",
    "供应商",
  );

  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<Supplier | null>(null);

  const fetchSupplierTypes = useCallback(async () => {
    try {
      const res = await api.get<DictionaryItem[]>(
        "/dictionaries/by-type/SUPPLIER_TYPE",
      );
      setSupplierTypes(res);
    } catch {
      setSupplierTypes([
        { id: "1", code: "CORPORATE", name: "企业", color: "blue" },
        { id: "2", code: "PERSONAL", name: "个人", color: "green" },
      ]);
    }
  }, []);

  const getSupplierType = (code: string) => {
    return (
      supplierTypes.find((item) => item.code === code) || {
        code,
        name: code,
        color: "default",
      }
    );
  };

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { page, pageSize };
      if (debouncedKeyword) params.keyword = debouncedKeyword;
      if (typeFilter) params.type = typeFilter;
      const res = await api.get<SupplierListResponse>("/suppliers", { params });
      setSuppliers(res.items || []);
      setTotal(res.total || 0);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载供应商失败"));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedKeyword, typeFilter]);

  useEffect(() => {
    fetchSupplierTypes();
  }, [fetchSupplierTypes]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleAdd = () => {
    setModalTitle("新增供应商");
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
    endpoint: "/suppliers/import",
    onImported: fetchSuppliers,
  });

  const handleEdit = (record: Supplier) => {
    setModalTitle("编辑供应商");
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingId) {
        await api.patch(`/suppliers/${editingId}`, values);
        message.success("更新成功");
      } else {
        await api.post("/suppliers", values);
        message.success("创建成功");
      }
      setModalVisible(false);
      setSelectedRowKeys([]);
      await fetchSuppliers();
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "操作失败"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const success = await deleteOne(id);
    if (success) {
      setSelectedRowKeys((prev) => prev.filter((key) => key !== id));
      await fetchSuppliers();
    }
  };

  const handleBatchDelete = async () => {
    await deleteBatch(selectedRowKeys);
    setSelectedRowKeys([]);
    await fetchSuppliers();
  };

  const handleView = async (id: string) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await api.get<Supplier>(`/suppliers/${id}`);
      setDetailData(res);
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "加载详情失败"));
      setDetailVisible(false);
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    {
      title: "供应商编号",
      dataIndex: "code",
      key: "code",
      width: 120,
    },
    {
      title: "供应商名称",
      dataIndex: "name",
      key: "name",
      width: 300,
      ellipsis: true,
    },
    {
      title: "供应商类型",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (type: string) => {
        const typeInfo = getSupplierType(type);
        return <Tag color={typeInfo.color || "default"}>{typeInfo.name}</Tag>;
      },
    },
    {
      title: "联系人",
      dataIndex: "contactName",
      key: "contactName",
      width: 100,
      render: (v: string) => v || "-",
    },
    {
      title: "联系电话",
      dataIndex: "contactPhone",
      key: "contactPhone",
      width: 130,
      render: (v: string) => v || "-",
    },
    {
      title: "合同数",
      dataIndex: "contractCount",
      key: "contractCount",
      width: 80,
      render: (v: number) => v || 0,
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, record: Supplier) => (
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
          <Popconfirm
            title="确定删除该供应商吗？"
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
          供应商管理
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
            title={`确定删除选中的 ${selectedRowKeys.length} 个供应商吗？`}
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
            新增供应商
          </Button>
        </Space>
      </div>

      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索供应商名称/编号/联系人"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => {
              setPage(1);
              setKeyword(e.target.value);
            }}
            style={{ width: 280 }}
            allowClear
          />
          <Select
            placeholder="供应商类型"
            value={typeFilter}
            onChange={(v) => {
              setPage(1);
              setTypeFilter(v);
            }}
            style={{ width: 140 }}
            allowClear
          >
            {supplierTypes.map((type) => (
              <Option key={type.code} value={type.code}>
                {type.name}
              </Option>
            ))}
          </Select>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="id"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        loading={loading}
        scroll={{ x: 1300 }}
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

      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={720}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="供应商名称"
            rules={[{ required: true, message: "请输入供应商名称" }]}
          >
            <Input placeholder="请输入供应商名称" />
          </Form.Item>

          <Form.Item
            name="type"
            label="供应商类型"
            rules={[{ required: true, message: "请选择供应商类型" }]}
          >
            <Select placeholder="请选择供应商类型">
              {supplierTypes.map((type) => (
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
            <Input placeholder="请输入联系人" />
          </Form.Item>

          <Form.Item name="contactPhone" label="联系电话">
            <Input placeholder="请输入联系电话" />
          </Form.Item>

          <Form.Item
            name="contactEmail"
            label="联系邮箱"
            rules={[{ type: "email", message: "请输入有效邮箱地址" }]}
          >
            <Input placeholder="请输入联系邮箱" />
          </Form.Item>

          <Form.Item name="address" label="地址">
            <Input.TextArea rows={2} placeholder="请输入地址" />
          </Form.Item>

          <Form.Item name="bankName" label="开户银行">
            <Input placeholder="请输入开户银行" />
          </Form.Item>

          <Form.Item name="bankAccountName" label="户名">
            <Input placeholder="请输入户名" />
          </Form.Item>

          <Form.Item name="bankAccountNo" label="银行账号">
            <Input placeholder="请输入银行账号" />
          </Form.Item>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="供应商详情"
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
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="供应商编号">
              {detailData.code || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="供应商名称">
              {detailData.name || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="供应商类型">
              {getSupplierType(detailData.type).name}
            </Descriptions.Item>
            <Descriptions.Item label="统一社会信用代码">
              {detailData.creditCode || "-"}
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
            <Descriptions.Item label="地址">
              {detailData.address || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="开户银行">
              {detailData.bankName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="户名">
              {detailData.bankAccountName || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="银行账号" span={2}>
              {detailData.bankAccountNo || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>
              {detailData.remark || "-"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
