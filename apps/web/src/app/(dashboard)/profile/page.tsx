"use client";

import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
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
  mfaEnabled?: boolean;
}

interface MfaStatusResponse {
  enabled: boolean;
}

interface MfaSetupResponse {
  secret: string;
  manualEntryKey: string;
  otpauthUrl: string;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(
    null,
  );
  const [enableCode, setEnableCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [form] = Form.useForm<{ code: string }>();

  const profileQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => api.get<CurrentProfile>("/auth/me"),
    enabled: !!user,
  });

  const mfaStatusQuery = useQuery({
    queryKey: ["auth", "mfa-status"],
    queryFn: () => api.get<MfaStatusResponse>("/auth/mfa/status"),
    enabled: !!user,
  });

  const setupMfaMutation = useMutation({
    mutationFn: () => api.post<MfaSetupResponse>("/auth/mfa/setup", {}),
    onSuccess: (data) => {
      setMfaSetupData(data);
      setEnableCode("");
      form.resetFields();
      setMfaModalOpen(true);
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, "初始化MFA失败"));
    },
  });

  const enableMfaMutation = useMutation({
    mutationFn: (code: string) => api.post("/auth/mfa/enable", { code }),
    onSuccess: async () => {
      message.success("MFA已启用");
      setMfaModalOpen(false);
      setMfaSetupData(null);
      await Promise.all([profileQuery.refetch(), mfaStatusQuery.refetch()]);
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, "启用MFA失败"));
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: (code: string) => api.post("/auth/mfa/disable", { code }),
    onSuccess: async () => {
      message.success("MFA已停用");
      setDisableCode("");
      await Promise.all([profileQuery.refetch(), mfaStatusQuery.refetch()]);
    },
    onError: (error: unknown) => {
      message.error(getErrorMessage(error, "停用MFA失败"));
    },
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

  const mfaEnabled = mfaStatusQuery.data?.enabled ?? !!profile.mfaEnabled;

  const handleEnableMfa = async () => {
    const values = await form.validateFields();
    setEnableCode(values.code);
    await enableMfaMutation.mutateAsync(values.code.trim());
  };

  const handleDisableMfa = async () => {
    if (!/^\d{6}$/.test(disableCode.trim())) {
      message.warning("请输入6位MFA验证码");
      return;
    }
    await disableMfaMutation.mutateAsync(disableCode.trim());
  };

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

            <Divider />

            <Descriptions column={1} size="middle" colon={false}>
              <Descriptions.Item label="MFA（二次验证）">
                {mfaEnabled ? (
                  <Tag color="success">已启用</Tag>
                ) : (
                  <Tag color="default">未启用</Tag>
                )}
              </Descriptions.Item>
            </Descriptions>

            {mfaEnabled ? (
              <Space direction="vertical" className="w-full" size={8}>
                <Input
                  placeholder="输入6位验证码后停用"
                  maxLength={6}
                  value={disableCode}
                  onChange={(event) =>
                    setDisableCode(event.target.value.replace(/\D/g, ""))
                  }
                />
                <Button
                  block
                  danger
                  loading={disableMfaMutation.isPending}
                  onClick={handleDisableMfa}
                >
                  停用MFA
                </Button>
              </Space>
            ) : (
              <Button
                block
                type="primary"
                loading={setupMfaMutation.isPending}
                onClick={() => setupMfaMutation.mutate()}
              >
                启用MFA
              </Button>
            )}
          </Card>
        </Col>
      </Row>

      <Modal
        title="启用MFA（二次验证）"
        open={mfaModalOpen}
        onCancel={() => {
          setMfaModalOpen(false);
          setMfaSetupData(null);
        }}
        onOk={handleEnableMfa}
        confirmLoading={enableMfaMutation.isPending}
        okText="验证并启用"
        cancelText="取消"
      >
        <Space direction="vertical" className="w-full" size={12}>
          <Alert
            type="info"
            showIcon
            message="请使用认证器（如 Google Authenticator / Microsoft Authenticator）扫描或手动录入密钥后，输入6位验证码完成启用。"
          />
          <Descriptions column={1} size="small" colon={false} bordered>
            <Descriptions.Item label="手动录入密钥">
              <Text code>{mfaSetupData?.manualEntryKey || "-"}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="otpauth 链接">
              <Text copyable className="break-all">
                {mfaSetupData?.otpauthUrl || "-"}
              </Text>
            </Descriptions.Item>
          </Descriptions>
          <Form form={form} layout="vertical">
            <Form.Item
              name="code"
              label="6位验证码"
              rules={[
                { required: true, message: "请输入6位验证码" },
                {
                  pattern: /^\d{6}$/,
                  message: "验证码格式不正确",
                },
              ]}
            >
              <Input
                maxLength={6}
                value={enableCode}
                onChange={(event) =>
                  setEnableCode(event.target.value.replace(/\D/g, ""))
                }
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}
