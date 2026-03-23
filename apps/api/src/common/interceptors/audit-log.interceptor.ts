// InfFinanceMs - 审计日志拦截器

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { tap } from "rxjs";
import { AuditService } from "../../modules/audit/audit.service";
import type { AuthenticatedUser } from "../types/auth-user.type";

type AuditAction = "CREATE" | "UPDATE" | "DELETE";
type AuditJson =
  | string
  | number
  | boolean
  | null
  | AuditJson[]
  | { [key: string]: AuditJson };

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const SENSITIVE_FIELDS = new Set([
  "password",
  "pass",
  "pwd",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "secret",
  "clientSecret",
]);
const REDACTED = "***REDACTED***";
const MAX_SANITIZE_DEPTH = 6;
const MAX_ARRAY_LENGTH = 200;

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const method = (request.method || "").toUpperCase();
    const pathname = `${request.baseUrl || ""}${request.path || ""}`;

    // 不记录浏览行为，只记录写操作
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    // 认证链路单独记录登录成功日志，其余认证写操作不记审计
    if (pathname.startsWith("/api/auth")) {
      return next.handle();
    }

    const userId = request.user?.id as string | undefined;
    if (!userId) {
      return next.handle();
    }

    const action = this.resolveAction(method, request.params?.id);
    if (!action) {
      return next.handle();
    }

    const entityType = this.resolveEntityType(pathname);
    const bodySnapshot = this.sanitizeAuditPayload(request.body);
    const ipAddress = request.ip;
    const userAgent = request.headers["user-agent"];
    const paramsId = (request.params?.id as string | undefined) || undefined;

    return next.handle().pipe(
      tap((result) => {
        const entityId = this.resolveEntityId(paramsId, bodySnapshot, result);
        void this.auditService.log(
          userId,
          action,
          entityType,
          entityId,
          null,
          bodySnapshot,
          ipAddress,
          typeof userAgent === "string" ? userAgent : undefined,
        );
      }),
    );
  }

  private resolveAction(method: string, entityId?: string): AuditAction | null {
    if (method === "POST") return entityId ? "UPDATE" : "CREATE";
    if (method === "PUT" || method === "PATCH") return "UPDATE";
    if (method === "DELETE") return "DELETE";
    return null;
  }

  private resolveEntityType(pathname: string): string {
    const normalized = pathname.replace(/^\/api\/?/, "");
    const [segment] = normalized.split("/");
    return (segment || "unknown").toLowerCase();
  }

  private resolveEntityId(
    paramsId?: string,
    body?: Record<string, unknown>,
    result?: Record<string, unknown>,
  ): string {
    if (paramsId) return paramsId;
    if (typeof result?.id === "string") return result.id;
    if (typeof body?.id === "string") return body.id;
    return "N/A";
  }

  private isSensitiveField(key: string): boolean {
    const normalized = key.trim().toLowerCase();
    if (!normalized) return false;
    if (SENSITIVE_FIELDS.has(key)) return true;
    if (SENSITIVE_FIELDS.has(normalized)) return true;
    return (
      normalized.includes("password") ||
      normalized.includes("token") ||
      normalized.includes("secret")
    );
  }

  private sanitizeAuditPayload(input: unknown): Record<string, unknown> | null {
    const sanitized = this.sanitizeValue(input, 0);
    if (
      !sanitized ||
      Array.isArray(sanitized) ||
      typeof sanitized !== "object"
    ) {
      return null;
    }
    return sanitized as Record<string, unknown>;
  }

  private sanitizeValue(input: unknown, depth: number): AuditJson {
    if (
      input === null ||
      typeof input === "string" ||
      typeof input === "number" ||
      typeof input === "boolean"
    ) {
      return input as string | number | boolean | null;
    }

    if (depth >= MAX_SANITIZE_DEPTH) {
      return "[TRUNCATED]";
    }

    if (Array.isArray(input)) {
      return input
        .slice(0, MAX_ARRAY_LENGTH)
        .map((item) => this.sanitizeValue(item, depth + 1));
    }

    if (typeof input === "object") {
      const result: { [key: string]: AuditJson } = {};
      for (const [key, value] of Object.entries(
        input as Record<string, unknown>,
      )) {
        result[key] = this.isSensitiveField(key)
          ? REDACTED
          : this.sanitizeValue(value, depth + 1);
      }
      return result;
    }

    return String(input);
  }
}
