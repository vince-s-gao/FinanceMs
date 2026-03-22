'use client';

// InfFinanceMs - 项目管理页面

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Select,
  message,
  Typography,
  Card,
  Modal,
  Form,
  DatePicker,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/constants';
import dayjs from 'dayjs';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 项目状态配置
const PROJECT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  SUSPENDED: '已暂停',
  CANCELLED: '已取消',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'processing',
  COMPLETED: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'default',
};

interface Project {
  id: string;
  code: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 加载项目列表
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<any>('/projects', { params });
      setProjects(res.items || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 打开新增/编辑弹窗
  const handleOpenModal = (project?: Project) => {
    setEditingProject(project || null);
    if (project) {
      form.setFieldsValue({
        ...project,
        startDate: project.startDate ? dayjs(project.startDate) : undefined,
        endDate: project.endDate ? dayjs(project.endDate) : undefined,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const payload = {
        ...values,
        startDate: values.startDate?.format('YYYY-MM-DD'),
        endDate: values.endDate?.format('YYYY-MM-DD'),
      };

      if (editingProject) {
        await api.put(`/projects/${editingProject.id}`, payload);
        message.success('更新成功');
      } else {
        await api.post('/projects', payload);
        message.success('创建成功');
      }

      setModalVisible(false);
      fetchProjects();
    } catch (error: any) {
      if (error.message) {
        message.error(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 删除项目
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`);
      message.success('删除成功');
      fetchProjects();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '项目编号',
      dataIndex: 'code',
      key: 'code',
      width: 130,
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: '项目描述',
      dataIndex: 'description',
      key: 'description',
      width: 250,
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={PROJECT_STATUS_COLORS[status]}>
          {PROJECT_STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 110,
      render: (v: string) => (v ? formatDate(v) : '-'),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 110,
      render: (v: string) => (v ? formatDate(v) : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (v: string) => formatDate(v),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: Project) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除该项目吗？"
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
          项目管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenModal()}
        >
          新增项目
        </Button>
      </div>

      {/* 搜索栏 */}
      <Card className="mb-4">
        <Space wrap>
          <Input
            placeholder="搜索项目编号/名称"
            prefix={<SearchOutlined />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="项目状态"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="ACTIVE">进行中</Option>
            <Option value="COMPLETED">已完成</Option>
            <Option value="SUSPENDED">已暂停</Option>
            <Option value="CANCELLED">已取消</Option>
          </Select>
        </Space>
      </Card>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={projects}
        rowKey="id"
        loading={loading}
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
        scroll={{ x: 1100 }}
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingProject ? '编辑项目' : '新增项目'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        confirmLoading={submitting}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="code"
            label="项目编号"
            extra="不填则自动生成"
          >
            <Input placeholder="请输入项目编号（可选）" disabled={!!editingProject} />
          </Form.Item>

          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="请输入项目名称" />
          </Form.Item>

          <Form.Item name="description" label="项目描述">
            <TextArea placeholder="请输入项目描述" rows={3} />
          </Form.Item>

          <Form.Item name="status" label="项目状态" initialValue="ACTIVE">
            <Select>
              <Option value="ACTIVE">进行中</Option>
              <Option value="COMPLETED">已完成</Option>
              <Option value="SUSPENDED">已暂停</Option>
              <Option value="CANCELLED">已取消</Option>
            </Select>
          </Form.Item>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="startDate" label="开始日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="endDate" label="结束日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
