// InfFinanceMs - 数据缓存 Hook

import { useState, useEffect, useCallback, useRef } from 'react';

// 简单的内存缓存
const cache = new Map<string, { data: any; timestamp: number }>();

// 缓存过期时间（默认 30 秒）
const CACHE_TTL = 30 * 1000;

interface UseCachedDataOptions<T> {
  // 缓存键
  cacheKey: string;
  // 数据获取函数
  fetcher: () => Promise<T>;
  // 是否启用缓存
  enabled?: boolean;
  // 缓存过期时间（毫秒）
  ttl?: number;
  // 初始数据
  initialData?: T;
}

interface UseCachedDataResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * 使用缓存的数据获取 Hook
 * 可以避免短时间内重复请求相同数据
 */
export function useCachedData<T>({
  cacheKey,
  fetcher,
  enabled = true,
  ttl = CACHE_TTL,
  initialData,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | undefined>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchingRef = useRef(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    // 如果正在获取中，不重复获取
    if (fetchingRef.current) return;

    // 检查缓存
    const cached = cache.get(cacheKey);
    const now = Date.now();
    
    if (!forceRefresh && cached && now - cached.timestamp < ttl) {
      setData(cached.data);
      return;
    }

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
      cache.set(cacheKey, { data: result, timestamp: now });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [cacheKey, fetcher, ttl]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, fetchData]);

  const refetch = useCallback(async () => {
    await fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * 清除指定缓存
 */
export function clearCache(cacheKey: string) {
  cache.delete(cacheKey);
}

/**
 * 清除所有缓存
 */
export function clearAllCache() {
  cache.clear();
}

/**
 * 预加载数据到缓存
 */
export function preloadData<T>(cacheKey: string, fetcher: () => Promise<T>, ttl = CACHE_TTL) {
  const cached = cache.get(cacheKey);
  const now = Date.now();
  
  if (!cached || now - cached.timestamp >= ttl) {
    fetcher().then(data => {
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }).catch(console.error);
  }
}
