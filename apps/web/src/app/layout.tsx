// InfFinanceMs - 根布局

import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryProvider } from '@/providers/QueryProvider';
import ServiceWorkerReset from '@/components/common/ServiceWorkerReset';
import './globals.css';

export const metadata: Metadata = {
  title: 'InfFinanceMs - 智能财务管理系统',
  description: '面向中小企业的轻量级财务管理系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorkerReset />
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: '#1890ff',
                borderRadius: 6,
              },
            }}
          >
            <QueryProvider>{children}</QueryProvider>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
