import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="auth-tech-bg min-h-screen flex items-center justify-center px-4">
      <div className="auth-tech-card w-full max-w-lg p-10 text-center">
        <h1 className="text-3xl font-semibold text-[#0b2751]">页面不存在</h1>
        <p className="mt-4 text-slate-600">
          你访问的地址在 InfFinanceMs 中未找到，请返回登录页或工作台继续操作。
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[#1677ff] px-5 py-2 text-white transition hover:bg-[#0958d9]"
          >
            返回登录
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2 text-slate-700 transition hover:border-slate-400"
          >
            前往工作台
          </Link>
        </div>
      </div>
    </div>
  );
}
