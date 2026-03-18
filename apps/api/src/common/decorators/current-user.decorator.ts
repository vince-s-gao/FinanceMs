// InfFinanceMs - 当前用户装饰器

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 当前用户装饰器
 * 用于从请求中获取当前登录用户信息
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // 如果指定了属性名，返回该属性
    if (data) {
      return user?.[data];
    }

    return user;
  },
);
