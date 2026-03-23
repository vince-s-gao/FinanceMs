// InfFinanceMs - JWT策略

import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";
import type { Request } from "express";

const DEV_FALLBACK_JWT_SECRET = "development-only-jwt-secret-change-me";
const ACCESS_TOKEN_TYPE = "access";

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  type?: string;
  sid?: string;
}

interface VerifiedJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  type?: string;
  sid?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  private static cookieTokenExtractor(req?: Request): string | null {
    const cookieHeader = req?.headers?.cookie as string | undefined;
    if (!cookieHeader) return null;
    const token = cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith("accessToken="));
    if (!token) return null;
    return decodeURIComponent(token.substring("accessToken=".length));
  }

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const jwtSecret = configService.get<string>("JWT_SECRET");
    const env = configService.get<string>("NODE_ENV", "development");
    const isProduction = env === "production";
    const resolvedSecret = jwtSecret || DEV_FALLBACK_JWT_SECRET;
    const isWeakSecret =
      resolvedSecret.length < 32 ||
      resolvedSecret === DEV_FALLBACK_JWT_SECRET ||
      resolvedSecret.includes("default-secret-key") ||
      resolvedSecret.includes("change-this");

    if (isWeakSecret && isProduction) {
      throw new Error("JWT_SECRET 配置无效或过弱，生产环境禁止启动");
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        JwtStrategy.cookieTokenExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolvedSecret,
    });

    // 开发环境保留提醒，生产环境在上方直接阻断启动
    if (isWeakSecret && !isProduction) {
      this.logger.warn("⚠️ 当前使用开发环境 JWT 密钥，请勿用于生产环境");
    }
  }

  async validate(payload: JwtPayload) {
    // 验证 payload 结构
    if (!payload || !payload.sub) {
      throw new UnauthorizedException("无效的令牌格式");
    }

    if (payload.type && payload.type !== ACCESS_TOKEN_TYPE) {
      throw new UnauthorizedException("无效的访问令牌类型");
    }

    const verifiedPayload: VerifiedJwtPayload = {
      ...payload,
      sub: payload.sub,
      sid: payload.sid,
    };

    const user = await this.authService.validateToken(verifiedPayload);
    if (!user) {
      throw new UnauthorizedException("无效的令牌");
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      this.logger.warn(`用户 ${user.email} 尝试使用已禁用账户访问系统`);
      throw new UnauthorizedException("账号已被禁用，请联系管理员");
    }

    return user;
  }
}
