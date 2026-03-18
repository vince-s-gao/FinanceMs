import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 不需要认证的路径
const publicPaths = ['/login', '/login/callback'];

function hasValidJwt(token?: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(''),
    );
    const payload = JSON.parse(json) as {
      exp?: number;
    };
    if (!payload.exp) return false;
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 检查是否是公共路径
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));

  // 获取 token
  const token = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  const hasAccess = hasValidJwt(token);
  const canAutoRefresh = !!refreshToken;

  // Next.js 内置 /error 路径会触发框架错误页，统一改写到业务路由避免用户误入。
  if (pathname === '/error' || pathname === '/_error') {
    const fallback = hasAccess || canAutoRefresh ? '/dashboard' : '/login';
    return NextResponse.redirect(new URL(fallback, request.url));
  }

  // 如果访问公共路径且已登录，重定向到 dashboard
  if (isPublicPath && hasAccess && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 如果访问受保护路径但未登录，重定向到登录页
  if (!isPublicPath && !hasAccess && !canAutoRefresh) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径除了：
     * - api (API 路由)
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon 文件)
     * - public 文件夹中的文件
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
