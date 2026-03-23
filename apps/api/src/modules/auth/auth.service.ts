// InfFinanceMs - 认证服务

import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { ERROR_CODE } from "@inffinancems/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { AuditService } from "../audit/audit.service";

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";

interface TokenUser {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string | null;
  avatar?: string | null;
  feishuUserId?: string | null;
  isActive?: boolean;
  password?: string | null;
  failedLoginAttempts?: number;
  lockedUntil?: Date | null;
  lastLoginIp?: string | null;
  lastLoginUserAgent?: string | null;
}

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  type?: string;
  sid?: string;
}

export interface LoginMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface TokenIssueResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditService: AuditService,
  ) {}

  private unauthorized(code: string, message: string): never {
    throw new UnauthorizedException({ code, message });
  }

  private projectUser(user: TokenUser) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      avatar: user.avatar,
      feishuUserId: user.feishuUserId,
    };
  }

  private parseDurationToSeconds(
    value: string | undefined,
    fallbackSeconds: number,
  ): number {
    if (!value) return fallbackSeconds;
    const matched = String(value)
      .trim()
      .match(/^(\d+)([smhd])$/i);
    if (!matched) return fallbackSeconds;
    const amount = Number(matched[1]);
    const unit = matched[2].toLowerCase();
    const unitSeconds: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return amount * (unitSeconds[unit] || 1);
  }

  private getAccessExpiresIn(): string {
    return this.configService.get<string>("JWT_EXPIRES_IN", "2h");
  }

  private getRefreshExpiresIn(): string {
    return (
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ||
      this.configService.get<string>("JWT_REFRESH_TOKEN_EXPIRES_IN") ||
      "30d"
    );
  }

  private getRefreshExpiresInSeconds(): number {
    return this.parseDurationToSeconds(
      this.getRefreshExpiresIn(),
      30 * 24 * 3600,
    );
  }

  private getMaxLoginAttempts(): number {
    const raw = Number(
      this.configService.get<string>("AUTH_MAX_LOGIN_ATTEMPTS", "5"),
    );
    if (Number.isNaN(raw)) return 5;
    return Math.min(Math.max(raw, 3), 10);
  }

  private getLockMinutes(): number {
    const raw = Number(
      this.configService.get<string>("AUTH_LOCK_MINUTES", "30"),
    );
    if (Number.isNaN(raw)) return 30;
    return Math.min(Math.max(raw, 5), 180);
  }

  private toLoginMetadata(metadata?: LoginMetadata): Required<LoginMetadata> {
    return {
      ipAddress: metadata?.ipAddress?.slice(0, 80) || "unknown",
      userAgent: metadata?.userAgent?.slice(0, 512) || "unknown",
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async createSessionAndTokens(
    user: TokenUser,
    metadata?: LoginMetadata,
  ): Promise<TokenIssueResult> {
    const sessionId = randomUUID();
    const issued = this.issueTokens(user, sessionId);
    const refreshTtlSeconds = this.getRefreshExpiresInSeconds();
    const meta = this.toLoginMetadata(metadata);

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: this.hashToken(issued.refreshToken),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + refreshTtlSeconds * 1000),
        lastActivityAt: new Date(),
      },
    });

    return {
      ...issued,
      sessionId,
    };
  }

  private async detectAndNotifyAnomaly(
    user: TokenUser,
    metadata?: LoginMetadata,
  ): Promise<void> {
    const meta = this.toLoginMetadata(metadata);
    const reasons: string[] = [];

    if (user.lastLoginIp && user.lastLoginIp !== meta.ipAddress) {
      reasons.push("登录IP发生变化");
    }

    if (user.lastLoginUserAgent && user.lastLoginUserAgent !== meta.userAgent) {
      reasons.push("登录设备发生变化");
    }

    if (reasons.length === 0) return;

    const reasonText = reasons.join("，");
    await this.notificationsService.createNotification({
      userId: user.id,
      type: "ALERT",
      title: "检测到异常登录",
      content: `系统检测到账号存在异常登录行为：${reasonText}。如非本人操作，请立即修改密码。`,
      metadata: {
        reason: reasons,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        at: new Date().toISOString(),
      },
    });

    await this.auditService.log(
      user.id,
      "LOGIN_ANOMALY",
      "auth",
      user.id,
      null,
      {
        reason: reasons,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
      meta.ipAddress,
      meta.userAgent,
    );
  }

  private async registerFailedLogin(
    user: TokenUser,
    metadata: LoginMetadata | undefined,
    reason: string,
  ): Promise<void> {
    const maxAttempts = this.getMaxLoginAttempts();
    const lockMinutes = this.getLockMinutes();
    const nextAttempts = (user.failedLoginAttempts || 0) + 1;
    const shouldLock = nextAttempts >= maxAttempts;
    const lockedUntil = shouldLock
      ? new Date(Date.now() + lockMinutes * 60 * 1000)
      : user.lockedUntil || null;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: shouldLock ? maxAttempts : nextAttempts,
        lockedUntil,
      },
    });

    const meta = this.toLoginMetadata(metadata);
    await this.auditService.logLogin(
      user.id,
      false,
      meta.ipAddress,
      meta.userAgent,
    );

    if (shouldLock) {
      await this.notificationsService.createNotification({
        userId: user.id,
        type: "ALERT",
        title: "账号已临时锁定",
        content: `由于连续登录失败达到 ${maxAttempts} 次，账号已临时锁定 ${lockMinutes} 分钟。`,
        metadata: {
          reason,
          attempts: maxAttempts,
          lockedUntil: lockedUntil?.toISOString(),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    }
  }

  private async clearLockIfExpired(user: TokenUser): Promise<TokenUser> {
    if (!user.lockedUntil) return user;
    if (user.lockedUntil.getTime() > Date.now()) return user;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: null,
        failedLoginAttempts: 0,
      },
    });

    return {
      ...user,
      lockedUntil: null,
      failedLoginAttempts: 0,
    };
  }

  issueTokens(user: TokenUser, sessionId: string): TokenIssueResult {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
    };

    const accessToken = this.jwtService.sign(
      {
        ...payload,
        type: ACCESS_TOKEN_TYPE,
      },
      {
        expiresIn: this.getAccessExpiresIn(),
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: REFRESH_TOKEN_TYPE,
      },
      {
        expiresIn: this.getRefreshExpiresIn(),
      },
    );

    return { accessToken, refreshToken, sessionId };
  }

  async issueLoginResult(user: TokenUser, metadata?: LoginMetadata) {
    const session = await this.createSessionAndTokens(user, metadata);
    await this.detectAndNotifyAnomaly(user, metadata);

    const meta = this.toLoginMetadata(metadata);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: meta.ipAddress,
        lastLoginUserAgent: meta.userAgent,
      },
    });

    await this.auditService.logLogin(
      user.id,
      true,
      meta.ipAddress,
      meta.userAgent,
    );

    return {
      ...session,
      user: this.projectUser(user),
    };
  }

  private async refreshByToken(refreshToken: string, metadata?: LoginMetadata) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "刷新令牌无效或已过期",
      );
    }

    if (
      !payload ||
      payload.type !== REFRESH_TOKEN_TYPE ||
      !payload.sub ||
      !payload.sid
    ) {
      this.unauthorized(ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID, "刷新令牌无效");
    }

    const now = new Date();
    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= now) {
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "会话已失效，请重新登录",
      );
    }

    if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
      await this.prisma.userSession.updateMany({
        where: {
          id: payload.sid,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "刷新令牌校验失败，请重新登录",
      );
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      this.unauthorized(ERROR_CODE.AUTH_USER_NOT_FOUND, "用户不存在或已禁用");
    }

    const issued = this.issueTokens(user, payload.sid);
    const meta = this.toLoginMetadata(metadata);

    await this.prisma.userSession.update({
      where: { id: payload.sid },
      data: {
        refreshTokenHash: this.hashToken(issued.refreshToken),
        lastActivityAt: now,
        expiresAt: new Date(
          Date.now() + this.getRefreshExpiresInSeconds() * 1000,
        ),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return {
      ...issued,
      user: this.projectUser(user),
    };
  }

  async refresh(refreshToken: string, metadata?: LoginMetadata) {
    return this.refreshByToken(refreshToken, metadata);
  }

  /**
   * 验证密码复杂度
   */
  private validatePasswordComplexity(password: string): void {
    if (password.length < 8) {
      this.unauthorized(
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        "密码长度至少为 8 位",
      );
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      this.unauthorized(
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        "密码必须包含大小写字母、数字和特殊字符",
      );
    }
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto, metadata?: LoginMetadata) {
    const email = loginDto.email.trim().toLowerCase();
    const password = loginDto.password;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`登录失败：邮箱 ${email} 不存在`);
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, "邮箱或密码错误");
    }

    const normalizedUser = await this.clearLockIfExpired(user);

    if (
      normalizedUser.lockedUntil &&
      normalizedUser.lockedUntil.getTime() > Date.now()
    ) {
      this.unauthorized(
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        `账号已锁定，请在 ${normalizedUser.lockedUntil.toLocaleString("zh-CN", { hour12: false })} 后重试`,
      );
    }

    if (!normalizedUser.isActive) {
      this.logger.warn(`登录失败：用户 ${email} 已被禁用`);
      this.unauthorized(
        ERROR_CODE.AUTH_ACCOUNT_DISABLED,
        "账号已被禁用，请联系管理员",
      );
    }

    if (!normalizedUser.password) {
      this.logger.warn(`登录失败：用户 ${email} 未设置密码，请使用飞书登录`);
      this.unauthorized(
        ERROR_CODE.AUTH_PASSWORD_NOT_SET,
        "该账户未设置密码，请使用飞书登录",
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      normalizedUser.password,
    );
    if (!isPasswordValid) {
      this.logger.warn(`登录失败：用户 ${email} 密码错误`);
      await this.registerFailedLogin(normalizedUser, metadata, "密码错误");
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, "邮箱或密码错误");
    }

    this.logger.log(`用户 ${email} 登录成功`);
    return this.issueLoginResult(normalizedUser, metadata);
  }

  /**
   * 验证JWT令牌
   */
  async validateToken(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      this.unauthorized(ERROR_CODE.AUTH_USER_NOT_FOUND, "用户不存在");
    }

    if (!user.isActive) {
      this.logger.warn(`令牌验证失败：用户 ${user.email} 已被禁用`);
      this.unauthorized(ERROR_CODE.AUTH_ACCOUNT_DISABLED, "账号已被禁用");
    }

    if (!payload.sid) {
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "会话无效，请重新登录",
      );
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    if (!session) {
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "会话已失效，请重新登录",
      );
    }

    return {
      ...user,
      sessionId: payload.sid,
    };
  }

  async listSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.userSession.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        lastActivityAt: "desc",
      },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((item) => ({
      ...item,
      isCurrent: currentSessionId === item.id,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count === 0) {
      this.unauthorized(
        ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID,
        "会话不存在或已失效",
      );
    }

    return { success: true };
  }

  async revokeOtherSessions(userId: string, currentSessionId?: string) {
    const result = await this.prisma.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revokedCount: result.count };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(refreshToken);
      if (!payload?.sid || !payload?.sub) return;
      await this.prisma.userSession.updateMany({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });
    } catch {
      // 忽略无效令牌，保持登出幂等
    }
  }

  /**
   * 为飞书用户生成随机密码
   */
  generateRandomPassword(): string {
    const length = 32;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i += 1) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
