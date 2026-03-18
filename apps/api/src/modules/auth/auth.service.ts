// InfFinanceMs - 认证服务

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { ERROR_CODE } from '@inffinancems/shared';

const ACCESS_TOKEN_TYPE = 'access';
const REFRESH_TOKEN_TYPE = 'refresh';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private unauthorized(code: string, message: string): never {
    throw new UnauthorizedException({ code, message });
  }

  private projectUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      avatar: user.avatar,
    };
  }

  issueTokens(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign({
      ...payload,
      type: ACCESS_TOKEN_TYPE,
    });

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: REFRESH_TOKEN_TYPE,
      },
      {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
      },
    );

    return { accessToken, refreshToken };
  }

  private async refreshByToken(refreshToken: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken);
    } catch {
      this.unauthorized(ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID, '刷新令牌无效或已过期');
    }

    if (!payload || payload.type !== REFRESH_TOKEN_TYPE || !payload.sub) {
      this.unauthorized(ERROR_CODE.AUTH_REFRESH_TOKEN_INVALID, '刷新令牌无效');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      this.unauthorized(ERROR_CODE.AUTH_USER_NOT_FOUND, '用户不存在或已禁用');
    }

    return {
      ...this.issueTokens(user),
      user: this.projectUser(user),
    };
  }

  async refresh(refreshToken: string) {
    return this.refreshByToken(refreshToken);
  }

  /**
   * 验证密码复杂度
   * @param password 密码
   */
  private validatePasswordComplexity(password: string): void {
    // 密码长度至少 8 位
    if (password.length < 8) {
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, '密码长度至少为 8 位');
    }

    // 必须包含大小写字母、数字和特殊字符
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, '密码必须包含大小写字母、数字和特殊字符');
    }
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // 查找用户
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`登录失败：邮箱 ${email} 不存在`);
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, '邮箱或密码错误');
    }

    // 检查用户状态
    if (!user.isActive) {
      this.logger.warn(`登录失败：用户 ${email} 已被禁用`);
      this.unauthorized(ERROR_CODE.AUTH_ACCOUNT_DISABLED, '账号已被禁用，请联系管理员');
    }

    // 检查密码是否存在（飞书用户可能没有密码）
    if (!user.password) {
      this.logger.warn(`登录失败：用户 ${email} 未设置密码，请使用飞书登录`);
      this.unauthorized(ERROR_CODE.AUTH_PASSWORD_NOT_SET, '该账户未设置密码，请使用飞书登录');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`登录失败：用户 ${email} 密码错误`);
      this.unauthorized(ERROR_CODE.AUTH_INVALID_CREDENTIALS, '邮箱或密码错误');
    }

    const { accessToken, refreshToken } = this.issueTokens(user);

    this.logger.log(`用户 ${email} 登录成功`);

    return {
      accessToken,
      refreshToken,
      user: this.projectUser(user),
    };
  }

  /**
   * 验证JWT令牌
   */
  async validateToken(payload: any) {
    const user = await this.usersService.findById(payload.sub);
    
    if (!user) {
      this.unauthorized(ERROR_CODE.AUTH_USER_NOT_FOUND, '用户不存在');
    }

    if (!user.isActive) {
      this.logger.warn(`令牌验证失败：用户 ${user.email} 已被禁用`);
      this.unauthorized(ERROR_CODE.AUTH_ACCOUNT_DISABLED, '账号已被禁用');
    }

    return user;
  }

  /**
   * 为飞书用户生成随机密码
   * @returns 随机生成的强密码
   */
  generateRandomPassword(): string {
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
  }
}
