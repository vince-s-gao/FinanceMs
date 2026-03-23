// InfFinanceMs - 功能权限装饰器

import { SetMetadata } from "@nestjs/common";

export const FUNCTIONS_KEY = "functions";

export const Functions = (...functions: string[]) =>
  SetMetadata(FUNCTIONS_KEY, functions);
