"use client";

import {
  Alert,
  Card,
  Col,
  Descriptions,
  Row,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";
import { ROLE_LABELS } from "@/lib/constants";
import { getErrorMessage } from "@/lib/error";

const { Title, Text } = Typography;

interface CurrentProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  avatar?: string | null;
  feishuUserId?: string | null;
}

export default function ProfilePage() {
  const { user } = useAuthStore();

  const profileQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentProfile>("/auth/me"),
    enabled: !!user,
  });

  if (profileQuery.isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (profileQuery.error) {
    return (
      <Alert
        type="error"
        showIcon
        message="加载个人信息失败"
        description={getErrorMessage(profileQuery.error, "请稍后重试")}
      />
    );
  }

  const profile = profileQuery.data;
  if (!profile) {
    return (
      <Alert
        type="warning"
        showIcon
        message="暂无个人信息"
        description="当前账号信息为空，请重新登录后重试。"
      />
    );
  }

  return (
    <div>
      <Title level={4}>个人信息</Title>
      <Text type="secondary">
        以下信息来自当前登录账号，如需修改请联系管理员。
      </Text>

      <Row gutter={[16, 16]} className="mt-4">
        <Col xs={24} lg={16}>
          <Card title="账号信息">
            <Descriptions column={1} size="middle" colon={false}>
              <Descriptions.Item label="姓名">
                {profile.name || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="邮箱">
                {profile.email || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="角色">
                <Tag color="blue">
                  {ROLE_LABELS[profile.role] || profile.role}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="部门">
                {profile.department || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="账号 ID">
                {profile.id}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="第三方绑定">
            <Descriptions column={1} size="middle" colon={false}>
              <Descriptions.Item label="飞书账号">
                {profile.feishuUserId ? (
                  <Tag color="success">已绑定</Tag>
                ) : (
                  <Tag color="default">未绑定</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
