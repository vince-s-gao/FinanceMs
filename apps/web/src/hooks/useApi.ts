// InfFinanceMs - React Query Hooks

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { message } from 'antd';

/**
 * 通用查询 Hook
 * @param queryKey 查询键
 * @param endpoint API 端点
 * @param params 查询参数
 */
export function useApiQuery<T>(
  queryKey: string[],
  endpoint: string,
  params?: Record<string, any>
) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.get<T>(endpoint, { params });
      return response;
    },
  });
}

/**
 * 通用变更 Hook
 * @param mutationKey 变更键
 * @param method HTTP 方法
 * @param endpoint API 端点
 * @param invalidateKeys 成功后失效的查询键
 */
export function useApiMutation<T, D = any>(
  mutationKey: string[],
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  endpoint: string,
  invalidateKeys?: string[][]
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey,
    mutationFn: async (data?: D) => {
      if (method === 'POST') {
        return api.post<T>(endpoint, data);
      } else if (method === 'PUT') {
        return api.put<T>(endpoint, data);
      } else if (method === 'PATCH') {
        return api.patch<T>(endpoint, data);
      } else {
        return api.delete<T>(endpoint);
      }
    },
    onSuccess: () => {
      // 失效相关查询，触发重新获取
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
    },
    onError: (error: any) => {
      message.error(error.message || '操作失败');
    },
  });
}

/**
 * 预取数据
 * @param queryKey 查询键
 * @param endpoint API 端点
 */
export function usePrefetch<T>(queryKey: string[], endpoint: string) {
  const queryClient = useQueryClient();

  return () => {
    queryClient.prefetchQuery({
      queryKey,
      queryFn: async () => {
        const response = await api.get<T>(endpoint);
        return response;
      },
    });
  };
}
