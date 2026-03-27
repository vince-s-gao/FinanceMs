// InfFinanceMs - Prisma服务

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const isDev = process.env.NODE_ENV === "development";
    const shouldTrackQuery = process.env.PRISMA_LOG_QUERY === "true";
    const enableQueryEvent = isDev || shouldTrackQuery;
    const logConfig: Prisma.PrismaClientOptions["log"] = enableQueryEvent
      ? [
          { emit: "event", level: "query" },
          { emit: "stdout", level: "error" },
          { emit: "stdout", level: "warn" },
        ]
      : [{ emit: "stdout", level: "error" }];

    super({
      log: logConfig,
    });

    const slowQueryThresholdMs = Number(
      process.env.SLOW_QUERY_THRESHOLD_MS || "500",
    );
    if (enableQueryEvent) {
      (this as any).$on(
        "query",
        (event: { duration: number; query: string }) => {
          if (
            Number.isFinite(slowQueryThresholdMs) &&
            event.duration >= slowQueryThresholdMs
          ) {
            const compactQuery = event.query.replace(/\s+/g, " ").trim();
            this.logger.warn(
              `Slow query detected (${event.duration}ms): ${compactQuery}`,
            );
          }
        },
      );
    }
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log("数据库连接成功");
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("数据库连接已断开");
  }
}
