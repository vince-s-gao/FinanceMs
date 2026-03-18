import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ERROR_CODE } from '@inffinancems/shared';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  private readonly skipPaths = [
    '/auth/login',
    '/auth/refresh',
    '/auth/logout',
    '/auth/csrf',
    '/auth/feishu/login',
    '/auth/feishu/exchange-ticket',
    '/auth/feishu/callback',
    '/api/auth/login',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/csrf',
    '/api/auth/feishu/login',
    '/api/auth/feishu/exchange-ticket',
    '/api/auth/feishu/callback',
  ];

  private getCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
    if (!cookieHeader) return undefined;
    const target = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    if (!target) return undefined;
    return decodeURIComponent(target.substring(name.length + 1));
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.safeMethods.has(req.method.toUpperCase())) {
      return next();
    }

    const requestPath = req.path;
    if (this.skipPaths.some((path) => requestPath.startsWith(path))) {
      return next();
    }

    const cookieToken = this.getCookieValue(req.headers.cookie, 'csrfToken');
    const headerToken = (req.headers['x-csrf-token'] as string | undefined)?.trim();

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException({
        code: ERROR_CODE.CSRF_TOKEN_INVALID,
        message: 'CSRF 校验失败，请刷新页面后重试',
      });
    }

    next();
  }
}
