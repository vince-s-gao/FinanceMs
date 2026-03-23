"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Descriptions,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/error";
import type { AuditLogItem, PaginatedData } from "@inffinancems/shared";

const { Title, Text } = Typography;
const { Option } = Select;

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "登录",
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "删除",
};

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "blue",
  CREATE: "green",
  UPDATE: "gold",
  DELETE: "red",
};

interface AuditMeta {
  actions: string[];
  entityTypes: string[];
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [actionFilter, setActionFilter] = useState<string>();
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>();
  const [keyword, setKeyword] = useState<string>();
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const metaQuery = useQuery({
    queryKey: ["audit-logs", "meta"],
    queryFn: () => api.get<AuditMeta>("/audit-logs/meta"),
    staleTime: 5 * 60 * 1000,
  });

  const logsQuery = useQuery({
    queryKey: [
      "audit-logs",
      page,
      pageSize,
      actionFilter,
      entityTypeFilter,
      keyword,
    ],
    queryFn: () =>
      api.get<PaginatedData<AuditLogItem>>("/audit-logs", {
        params: {
          page,
          pageSize,
          action: actionFilter,
          entityType: entityTypeFilter,
          keyword,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const columns = useMemo<TableColumnsType<AuditLogItem>>(
    () => [
      {
        title: "时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 180,
        render: (value: string) => new Date(value).toLocaleString("zh-CN"),
      },
      {
        title: "操作人",
        key: "user",
        width: 220,
        render: (_: unknown, record: AuditLogItem) =>
          record.user ? (
            <div>
              <div>{record.user.name}</div>
              <Text type="secondary" className="text-xs">
                {record.user.email}
              </Text>
            </div>
          ) : (
            "-"
          ),
      },
      {
        title: "操作类型",
        dataIndex: "action",
        key: "action",
        width: 100,
        render: (value: string) => (
          <Tag color={ACTION_COLORS[value] || "default"}>
            {ACTION_LABELS[value] || value}
          </Tag>
        ),
      },
      {
        title: "模块",
        dataIndex: "entityType",
        key: "entityType",
        width: 140,
      },
      {
        title: "目标ID",
        dataIndex: "entityId",
        key: "entityId",
        width: 220,
        ellipsis: true,
      },
      {
        title: "IP",
        dataIndex: "ipAddress",
        key: "ipAddress",
        width: 150,
        render: (value: string | null) => value || "-",
      },
      {
        title: "详情",
        key: "detail",
        width: 100,
        render: (_: unknown, record: AuditLogItem) => (
          <Button
            type="link"
            size="small"
            onClick={() => setSelectedLog(record)}
          >
            查看
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <Title level={4}>日志管理</Title>

      <Card className="mb-4">
        <Space wrap>
          <Select
            placeholder="操作类型"
            value={actionFilter}
            onChange={(value) => {
              setPage(1);
              setActionFilter(value);
            }}
            style={{ width: 140 }}
            allowClear
          >
            {(metaQuery.data?.actions || []).map((action) => (
              <Option key={action} value={action}>
                {ACTION_LABELS[action] || action}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="模块"
            value={entityTypeFilter}
            onChange={(value) => {
              setPage(1);
              setEntityTypeFilter(value);
            }}
            style={{ width: 180 }}
            allowClear
          >
            {(metaQuery.data?.entityTypes || []).map((entityType) => (
              <Option key={entityType} value={entityType}>
                {entityType}
              </Option>
            ))}
          </Select>

          <Input.Search
            placeholder="搜索目标ID/操作人"
            allowClear
            style={{ width: 280 }}
            onSearch={(value) => {
              setPage(1);
              setKeyword(value || undefined);
            }}
          />
        </Space>
      </Card>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={logsQuery.data?.items || []}
        loading={logsQuery.isLoading || logsQuery.isFetching}
        scroll={{ x: 1150 }}
        pagination={{
          current: page,
          pageSize,
          total: logsQuery.data?.total || 0,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        locale={{
          emptyText: logsQuery.error
            ? getErrorMessage(logsQuery.error, "日志加载失败")
            : "暂无日志",
        }}
      />

      <Modal
        title="日志详情"
        open={!!selectedLog}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={820}
      >
        {selectedLog && (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="时间">
              {new Date(selectedLog.createdAt).toLocaleString("zh-CN")}
            </Descriptions.Item>
            <Descriptions.Item label="操作类型">
              <Tag color={ACTION_COLORS[selectedLog.action] || "default"}>
                {ACTION_LABELS[selectedLog.action] || selectedLog.action}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="模块">
              {selectedLog.entityType}
            </Descriptions.Item>
            <Descriptions.Item label="目标ID">
              {selectedLog.entityId}
            </Descriptions.Item>
            <Descriptions.Item label="操作人">
              {selectedLog.user
                ? `${selectedLog.user.name} (${selectedLog.user.email})`
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="IP">
              {selectedLog.ipAddress || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="User-Agent">
              {selectedLog.userAgent || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="新值">
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap text-xs bg-gray-50 p-3 rounded">
                {selectedLog.newValue
                  ? JSON.stringify(selectedLog.newValue, null, 2)
                  : "-"}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
