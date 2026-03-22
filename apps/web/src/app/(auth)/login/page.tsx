'use client';

// InfFinanceMs - 登录页面

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, message, Typography, Divider, Spin } from 'antd';
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error';

const { Title, Text } = Typography;

// 飞书图标组件
const FeishuIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/>
  </svg>
);

interface LoginForm {
  email: string;
  password: string;
}

// 是否启用飞书登录
const FEISHU_ENABLED = process.env.NEXT_PUBLIC_FEISHU_ENABLED === 'true';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [feishuLoading, setFeishuLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const ensureCsrfToken = async () => {
    await api.get('/auth/csrf');
  };

  // 处理飞书登录错误
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'feishu_auth_failed') {
      message.error('飞书登录失败，请重试');
    } else if (error === 'feishu_state_invalid') {
      message.error('登录状态校验失败，请重新发起飞书登录');
    }
  }, [searchParams]);

  // 无痕/首次访问时先拿到 CSRF token，避免首次登录被拦截
  useEffect(() => {
    ensureCsrfToken().catch(() => {
      // 用户提交时会再次尝试获取 token
    });
  }, []);

  // 邮箱密码登录
  const handleSubmit = async (values: LoginForm) => {
    try {
      await ensureCsrfToken();
      await login(values.email, values.password);
      message.success('登录成功');
      
      // 登录成功后跳转到 dashboard
      router.push('/dashboard');
      router.refresh(); // 刷新路由确保 middleware 重新检查
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '登录失败，请检查邮箱和密码'));
    }
  };

  // 飞书登录
  const handleFeishuLogin = async () => {
    setFeishuLoading(true);
    try {
      const res = await api.get<{ url: string }>('/auth/feishu/url', { withCredentials: true });
      // 跳转到飞书授权页面
      window.location.href = res.url;
    } catch (error: unknown) {
      message.error(getErrorMessage(error, '获取飞书授权链接失败'));
      setFeishuLoading(false);
    }
  };

  return (
    <div className="auth-tech-bg min-h-screen flex items-center justify-center px-4">
      <Card className="auth-tech-card w-full max-w-md tech-float" variant="borderless">
        <div className="text-center mb-8">
          <Title level={2} className="!mb-2 !text-[#0b2751]">
            欢迎登录InfFinanceMs
          </Title>
          <Text type="secondary">智能财务管理系统 · 安全高效的企业财务协作平台</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="邮箱"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码长度不能少于8位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="密码"
              visibilityToggle={{
                visible: passwordVisible,
                onVisibleChange: setPasswordVisible,
              }}
              iconRender={(visible) =>
                visible ? <EyeTwoTone twoToneColor="#1890ff" /> : <EyeInvisibleOutlined />
              }
            />
          </Form.Item>

          <Form.Item className="mb-4">
            <Button
              type="primary"
              htmlType="submit"
              loading={isLoading}
              block
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        {/* 飞书登录 */}
        {FEISHU_ENABLED && (
          <>
            <Divider plain>
              <Text type="secondary" className="text-xs">或</Text>
            </Divider>

            <Button
              block
              size="large"
              icon={<FeishuIcon />}
              loading={feishuLoading}
              onClick={handleFeishuLogin}
              className="flex items-center justify-center gap-2"
              style={{ 
                backgroundColor: '#3370ff', 
                borderColor: '#3370ff',
                color: '#fff',
              }}
            >
              使用飞书账号登录
            </Button>
          </>
        )}

        <div className="text-center mt-6">
          <Text type="secondary" className="text-xs">
            测试账号密码由环境变量初始化，请联系管理员获取
          </Text>
        </div>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="auth-tech-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-[#d3e6ff]">正在加载...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
