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

const DEV_FALLBACK_JWT_SECRET = "development-only-jwt-secret-change-me";

@Module({
  imports: [
    UsersModule,
    PrismaModule,
    AuditModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const env = configService.get<string>("NODE_ENV", "development");
        const isProduction = env === "production";
        const jwtSecret = configService.get<string>("JWT_SECRET");
        const resolvedSecret = jwtSecret || DEV_FALLBACK_JWT_SECRET;

        const isWeakSecret =
          resolvedSecret.length < 32 ||
          resolvedSecret === DEV_FALLBACK_JWT_SECRET ||
          resolvedSecret.includes("default-secret-key") ||
          resolvedSecret.includes("change-this");

        if (isWeakSecret && isProduction) {
          throw new Error("JWT_SECRET 配置无效或过弱，生产环境禁止启动");
        }

        if (isWeakSecret && !isProduction) {
          // 开发环境允许弱密钥，仅用于本地调试
          console.warn("⚠️ 当前使用开发环境 JWT 密钥，请勿用于生产环境");
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
