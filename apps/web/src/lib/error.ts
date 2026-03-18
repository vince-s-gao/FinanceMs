import { ERROR_CODE } from '@inffinancems/shared';

type ErrorWithMeta = {
  code?: string;
  message?: string;
};

const FRIENDLY_ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODE.CSRF_TOKEN_INVALID]: '会话校验失败，请刷新页面后重试',
  [ERROR_CODE.AUTH_INVALID_CREDENTIALS]: '账号或密码错误，请重试',
  [ERROR_CODE.AUTH_ACCOUNT_DISABLED]: '账号已被禁用，请联系管理员',
  [ERROR_CODE.AUTH_PASSWORD_NOT_SET]: '该账户未设置密码，请使用飞书登录',
  [ERROR_CODE.AUTH_REFRESH_TOKEN_MISSING]: '登录状态异常，请重新登录',
  [ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID]: '登录状态已过期，请重新登录',
  [ERROR_CODE.COST_PROJECT_NOT_FOUND]: '关联项目不存在，请刷新后重试',
  [ERROR_CODE.COST_CONTRACT_NOT_FOUND]: '关联合同不存在，请刷新后重试',
  [ERROR_CODE.COST_DELETE_REIMBURSEMENT_FORBIDDEN]: '报销生成的费用不支持直接删除',
  REQUEST_TIMEOUT: '请求超时，请稍后重试',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试',
  HTTP_401: '登录状态已失效，请重新登录',
  HTTP_403: '没有权限执行此操作',
  HTTP_404: '请求的资源不存在',
  HTTP_429: '操作过于频繁，请稍后再试',
  HTTP_500: '服务器繁忙，请稍后再试',
};

function asErrorMeta(error: unknown): ErrorWithMeta {
  if (!error || typeof error !== 'object') {
    return {};
  }
  return error as ErrorWithMeta;
}

/**
 * 将后端统一错误结构映射为可直接展示给用户的文案。
 */
export function getErrorMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  const meta = asErrorMeta(error);
  if (meta.code && FRIENDLY_ERROR_MESSAGES[meta.code]) {
    return FRIENDLY_ERROR_MESSAGES[meta.code];
  }
  if (meta.message && meta.message.trim()) {
    return meta.message;
  }
  return fallback;
}
