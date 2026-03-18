'use client';

import { useState } from 'react';
import { Button, Card, Input, message, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

export default function TestLoginPage() {
  const [email, setEmail] = useState('admin@inffinancems.com');
  const [password, setPassword] = useState('Admin@123');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testLogin = async () => {
    setLoading(true);
    setResult(null);

    try {
      // 1. 测试登录API
      const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json();

      if (!loginResponse.ok) {
        throw new Error(loginData.message || '登录失败');
      }

      setResult({
        step: '登录成功',
        data: loginData,
      });

      // 2. 测试受保护的API（使用 httpOnly Cookie）
      const meResponse = await fetch('http://localhost:3001/api/auth/me', {
        credentials: 'include',
      });

      const meData = await meResponse.json();

      setResult((prev: any) => ({
        ...prev,
        step: '获取用户信息成功',
        meData,
      }));

      // 4. 检查cookie
      const cookies = document.cookie;
      setResult((prev: any) => ({
        ...prev,
        step: 'Cookie设置成功',
        cookies,
      }));

      // 5. 测试跳转到dashboard
      message.success('登录测试成功！即将跳转到dashboard...');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);

    } catch (error: any) {
      message.error(error.message || '测试失败');
      setResult({
        step: '失败',
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const checkCookies = () => {
    const cookies = document.cookie;
      setResult({
        step: '当前Cookie',
        cookies,
      });
    };

  const clearAuth = async () => {
    await fetch('http://localhost:3001/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    message.success('已清除认证信息');
    setResult(null);
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <Card className="max-w-2xl mx-auto">
        <Title level={2}>登录测试页面</Title>
        <Divider />

        <div className="space-y-4">
          <div>
            <Text strong>邮箱：</Text>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@inffinancems.com"
            />
          </div>

          <div>
            <Text strong>密码：</Text>
            <Input.Password
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin@123"
            />
          </div>

          <div className="flex gap-2">
            <Button type="primary" onClick={testLogin} loading={loading}>
              测试登录
            </Button>
            <Button onClick={checkCookies}>
              检查Cookie
            </Button>
            <Button danger onClick={clearAuth}>
              清除认证
            </Button>
          </div>
        </div>

        {result && (
          <>
            <Divider />
            <div>
              <Text strong>测试结果：</Text>
              <pre className="mt-2 p-4 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
