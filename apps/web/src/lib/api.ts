// InfFinanceMs - API 客户端

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = (() => {
  if (typeof window !== 'undefined') {
    const configured = process.env.NEXT_PUBLIC_API_URL;
    if (configured) {
      // 避免 localhost/127.0.0.1 不一致导致跨站 Cookie 问题
      if (window.location.hostname === '127.0.0.1' && configured.includes('://localhost')) {
        return configured.replace('://localhost', '://127.0.0.1');
      }
      if (window.location.hostname === 'localhost' && configured.includes('://127.0.0.1')) {
        return configured.replace('://127.0.0.1', '://localhost');
      }
      return configured;
    }
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || '127.0.0.1';
    return `${protocol}//${hostname}:3001/api`;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return 'http://127.0.0.1:3001/api';
})();

interface PendingRequest {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface StandardApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  data?: unknown;
}

const SKIP_REFRESH_HEADER = 'X-Skip-Auth-Refresh';

let isRefreshing = false;
const pendingRequests: PendingRequest[] = [];

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const target = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.substring(name.length + 1)) : null;
}

function shouldAttachCsrfHeader(method?: string): boolean {
  if (!method) return false;
  const upper = method.toUpperCase();
  return upper === 'POST' || upper === 'PUT' || upper === 'PATCH' || upper === 'DELETE';
}

function isAuthPath(url?: string): boolean {
  if (!url) return false;
  return (
    url.includes('/auth/login') ||
    url.includes('/auth/refresh') ||
    url.includes('/auth/logout') ||
    url.includes('/auth/feishu')
  );
}

function toApiError(error: AxiosError | unknown): StandardApiError {
  if (axios.isAxiosError(error) && error.response) {
    const { status, data } = error.response as any;
    const rawMessage = data?.message;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : rawMessage || '请求失败';
    return {
      status,
      code: data?.code || `HTTP_${status}`,
      message,
      details: data?.details,
      data,
    };
  }
  if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
    return {
      status: 0,
      code: 'REQUEST_TIMEOUT',
      message: '请求超时，请稍后重试',
    };
  }
  return {
    status: 0,
    code: 'NETWORK_ERROR',
    message: '网络连接失败，请检查网络',
  };
}

function flushPendingRequests(error?: unknown) {
  const list = pendingRequests.splice(0, pendingRequests.length);
  list.forEach((item) => {
    if (error) {
      item.reject(error);
      return;
    }
    item.resolve();
  });
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.withCredentials = true;

    if (shouldAttachCsrfHeader(config.method)) {
      const csrfToken = readCookie('csrfToken');
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(toApiError(error)),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const skipHeader =
      (originalRequest?.headers as any)?.[SKIP_REFRESH_HEADER] ||
      (originalRequest?.headers as any)?.['x-skip-auth-refresh'];
    const shouldSkipRefresh =
      !!skipHeader ||
      isAuthPath(originalRequest?.url);

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !shouldSkipRefresh) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingRequests.push({
            resolve: async () => {
              try {
                originalRequest._retry = true;
                resolve(await apiClient(originalRequest));
              } catch (retryError) {
                reject(toApiError(retryError));
              }
            },
            reject: (refreshError) => reject(toApiError(refreshError)),
          });
        });
      }

      isRefreshing = true;
      originalRequest._retry = true;

      try {
        await apiClient.post(
          '/auth/refresh',
          {},
          { headers: { [SKIP_REFRESH_HEADER]: '1' } },
        );
        flushPendingRequests();
        return apiClient(originalRequest);
      } catch (refreshError) {
        flushPendingRequests(refreshError);
        try {
          await apiClient.post(
            '/auth/logout',
            {},
            { headers: { [SKIP_REFRESH_HEADER]: '1' } },
          );
        } catch {
          // ignore logout cleanup errors
        }
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.replace('/login');
        }
        return Promise.reject(toApiError(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    if (error.response?.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.replace('/login');
    }

    return Promise.reject(toApiError(error));
  },
);

export const api = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.get<T>(url, config).then((res) => res.data),

  post: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.post<T>(url, data, config).then((res) => res.data),

  put: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.put<T>(url, data, config).then((res) => res.data),

  patch: <T>(url: string, data?: any, config?: AxiosRequestConfig) =>
    apiClient.patch<T>(url, data, config).then((res) => res.data),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiClient.delete<T>(url, config).then((res) => res.data),
};

export default apiClient;
