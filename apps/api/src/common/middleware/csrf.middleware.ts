import { ForbiddenException, Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { ERROR_CODE } from "@inffinancems/shared";

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);

  private readonly skipPaths = [
    "/auth/login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/csrf",
    "/auth/feishu/login",
    "/auth/feishu/exchange-ticket",
    "/auth/feishu/callback",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/csrf",
    "/api/auth/feishu/login",
    "/api/auth/feishu/exchange-ticket",
    "/api/auth/feishu/callback",
  ];

  private getCookieValue(
    cookieHeader: string | undefined,
    name: string,
  ): string | undefined {
    if (!cookieHeader) return undefined;
    const target = cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    if (!target) return undefined;
    return decodeURIComponent(target.substring(name.length + 1));
  }

  private extractCandidatePaths(req: Request): string[] {
    const stripQuery = (value?: string) => {
      if (!value) return "";
      const idx = value.indexOf("?");
      return idx >= 0 ? value.slice(0, idx) : value;
    };

    const originalUrl = stripQuery(req.originalUrl);
    const baseWithPath = stripQuery(`${req.baseUrl || ""}${req.path || ""}`);
    const pathOnly = stripQuery(req.path);
    const urlOnly = stripQuery(req.url);

    return Array.from(
      new Set(
        [originalUrl, baseWithPath, pathOnly, urlOnly].filter((item) => !!item),
      ),
    );
  }

  private shouldSkipByPath(req: Request): boolean {
    const candidates = this.extractCandidatePaths(req);
    return candidates.some((candidate) =>
      this.skipPaths.some((path) => candidate.startsWith(path)),
    );
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.safeMethods.has(req.method.toUpperCase())) {
      return next();
    }

    if (this.shouldSkipByPath(req)) {
      return next();
    }

    const cookieToken = this.getCookieValue(req.headers.cookie, "csrfToken");
    const headerToken = (
      req.headers["x-csrf-token"] as string | undefined
    )?.trim();

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException({
        code: ERROR_CODE.CSRF_TOKEN_INVALID,
        message: "CSRF 校验失败，请刷新页面后重试",
      });
    }

    next();
  }
}
