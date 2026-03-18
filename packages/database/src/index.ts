// InfFinanceMs - 数据库模块导出
// 导出 Prisma Client 和相关类型

import { PrismaClient } from '@prisma/client';

// 创建全局 Prisma 实例（避免开发环境热重载时创建多个连接）
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// 导出 Prisma Client 类
export { PrismaClient };

// 导出所有生成的类型
export * from '@prisma/client';
