// InfFinanceMs - 功能权限守卫

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FUNCTIONS_KEY } from "../decorators/functions.decorator";
import { PermissionsService } from "../../modules/permissions/permissions.service";
import type { AuthenticatedUser } from "../types/auth-user.type";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFunctions = this.reflector.getAllAndOverride<string[]>(
      FUNCTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFunctions || requiredFunctions.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const role = request?.user?.role;

    // 认证由 JwtAuthGuard 处理；这里仅在已有登录用户时校验功能权限。
    if (!role) {
      return true;
    }

    const permissions = await this.permissionsService.getRolePermissions(role);
    const granted = new Set(permissions.functions || []);
    const missing = requiredFunctions.filter((key) => !granted.has(key));

    if (missing.length > 0) {
      throw new ForbiddenException(
        `权限不足，缺少功能权限: ${missing.join(", ")}`,
      );
    }

    return true;
  }
}
