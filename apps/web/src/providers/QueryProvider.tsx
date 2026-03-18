'use client';

// InfFinanceMs - React Query Provider

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, ReactNode } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 数据缓存 5 分钟
            staleTime: 5 * 60 * 1000,
            // 缓存保留 10 分钟
            gcTime: 10 * 60 * 1000,
            // 窗口聚焦时不自动重新获取
            refetchOnWindowFocus: false,
            // 失败重试 1 次
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
