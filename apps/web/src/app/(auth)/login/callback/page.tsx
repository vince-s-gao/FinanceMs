'use client';

// InfFinanceMs - 飞书登录回调页面

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spin, message } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import type { LoginResponse } from '@inffinancems/shared';

function LoginCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const handleCallback = async () => {
      const ticket = searchParams.get('ticket');
      const error = searchParams.get('error');

      if (error) {
        message.error('登录失败，请重试');
        router.push('/login');
        return;
      }

      if (ticket) {
        try {
          const result = await api.post<LoginResponse>('/auth/feishu/exchange-ticket', { ticket });
          setAuth(result.user);

          message.success('登录成功');
          router.push('/dashboard');
        } catch (error: unknown) {
          message.error(getErrorMessage(error, '登录票据无效或已过期，请重试'));
          router.push('/login');
        }
        return;
      }

      router.push('/login');
    };

    handleCallback();
  }, [searchParams, router, setAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <Spin size="large" />
        <p className="mt-4 text-gray-500">正在登录，请稍候...</p>
      </div>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <Spin size="large" />
          <p className="mt-4 text-gray-500">正在加载...</p>
        </div>
      </div>
    }>
      <LoginCallbackContent />
    </Suspense>
  );
}
