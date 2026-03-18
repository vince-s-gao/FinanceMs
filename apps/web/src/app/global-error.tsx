'use client';

import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="auth-tech-bg min-h-screen flex items-center justify-center px-4">
          <div className="auth-tech-card w-full max-w-lg p-10 text-center">
            <h1 className="text-3xl font-semibold text-[#0b2751]">系统出现异常</h1>
            <p className="mt-4 text-slate-600">
              请稍后重试。如果问题持续存在，请联系管理员并提供错误摘要。
            </p>
            <p className="mt-2 text-xs text-slate-500">{error?.digest || 'NO_DIGEST'}</p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-lg bg-[#1677ff] px-5 py-2 text-white transition hover:bg-[#0958d9]"
              >
                重试
              </button>
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-slate-700 transition hover:border-slate-400"
              >
                返回工作台
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
