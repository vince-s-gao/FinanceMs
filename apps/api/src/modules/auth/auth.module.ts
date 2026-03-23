// InfFinanceMs - 认证模块

import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { FeishuService } from "./feishu.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { UsersModule } from "../users/users.module";
import { PrismaModule } from "../../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { randomBytes } from "crypto";

let devFallbackJwtSecret: string | null = null;

function getDevFallbackJwtSecret(): string {
  if (devFallbackJwtSecret) return devFallbackJwtSecret;
  devFallbackJwtSecret = randomBytes(48).toString("base64url");
  return devFallbackJwtSecret;
}

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    AuditModule,
    NotificationsModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const env = configService.get<string>("NODE_ENV", "development");
        const isProduction = env === "production";
        const jwtSecret = configService.get<string>("JWT_SECRET");
        const usingFallbackSecret = !jwtSecret;
        const resolvedSecret = jwtSecret || getDevFallbackJwtSecret();

        const isWeakSecret =
          resolvedSecret.length < 32 ||
          resolvedSecret.includes("default-secret-key") ||
          resolvedSecret.includes("change-this");

        if ((isWeakSecret || usingFallbackSecret) && isProduction) {
          throw new Error("JWT_SECRET 配置无效或过弱，生产环境禁止启动");
        }

        if (usingFallbackSecret && !isProduction) {
          console.warn(
            "⚠️ 未配置 JWT_SECRET，已启用进程随机密钥（重启后会失效），请尽快配置固定强密钥",
          );
        } else if (isWeakSecret && !isProduction) {
          console.warn("⚠️ 当前 JWT_SECRET 强度较弱，请勿用于生产环境");
        }

        return {
          secret: resolvedSecret,
          signOptions: {
            expiresIn: configService.get<string>("JWT_EXPIRES_IN", "2h"),
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, FeishuService, JwtStrategy],
  exports: [AuthService, FeishuService],
})
export class AuthModule {}
