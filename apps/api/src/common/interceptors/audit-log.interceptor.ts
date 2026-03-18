// InfFinanceMs - 审计日志拦截器

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { tap } from 'rxjs';
import { AuditService } from '../../modules/audit/audit.service';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: any }>();
    const method = (request.method || '').toUpperCase();
    const pathname = `${request.baseUrl || ''}${request.path || ''}`;

    // 不记录浏览行为，只记录写操作
    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    // 认证链路单独记录登录成功日志，其余认证写操作不记审计
    if (pathname.startsWith('/api/auth')) {
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
    const bodySnapshot = request.body;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];
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
          typeof userAgent === 'string' ? userAgent : undefined,
        );
      }),
    );
  }

  private resolveAction(method: string, entityId?: string): AuditAction | null {
    if (method === 'POST') return entityId ? 'UPDATE' : 'CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
    if (method === 'DELETE') return 'DELETE';
    return null;
  }

  private resolveEntityType(pathname: string): string {
    const normalized = pathname.replace(/^\/api\/?/, '');
    const [segment] = normalized.split('/');
    return (segment || 'unknown').toLowerCase();
  }

  private resolveEntityId(paramsId?: string, body?: any, result?: any): string {
    if (paramsId) return paramsId;
    if (result?.id && typeof result.id === 'string') return result.id;
    if (body?.id && typeof body.id === 'string') return body.id;
    return 'N/A';
  }
}
