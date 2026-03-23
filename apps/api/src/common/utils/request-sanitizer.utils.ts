const SENSITIVE_QUERY_KEYS = new Set(
  [
    "token",
    "access_token",
    "accessToken",
    "refresh_token",
    "refreshToken",
    "code",
    "ticket",
    "state",
    "password",
    "secret",
    "signature",
    "authorization",
    "cookie",
  ].map((item) => item.toLowerCase()),
);

function looksLikeSensitiveToken(value: string): boolean {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 24) return false;
  return /^[A-Za-z0-9._~+/=-]+$/.test(trimmed);
}

/**
 * 脱敏请求 URL，避免日志和错误响应中泄露 code/token 等敏感参数。
 */
export function sanitizeRequestUrl(rawUrl?: string): string {
  if (!rawUrl) return "/";

  let parsed: URL;
  try {
    parsed = new URL(rawUrl, "http://localhost");
  } catch {
    return rawUrl.split("?")[0] || rawUrl;
  }

  const sanitizedParams = new URLSearchParams();
  parsed.searchParams.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (
      SENSITIVE_QUERY_KEYS.has(normalizedKey) ||
      looksLikeSensitiveToken(value)
    ) {
      sanitizedParams.set(key, "***");
      return;
    }

    const safeValue = value.length > 128 ? `${value.slice(0, 128)}...` : value;
    sanitizedParams.set(key, safeValue);
  });

  const query = sanitizedParams.toString();
  return `${parsed.pathname}${query ? `?${query}` : ""}`;
}
