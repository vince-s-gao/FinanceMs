// InfFinanceMs - 飞书认证服务

import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

// 飞书用户信息接口
interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  user_id: string;
  name: string;
  en_name?: string;
  avatar_url?: string;
  avatar_thumb?: string;
  email?: string;
  mobile?: string;
  tenant_key: string;
}

// 飞书 Token 响应接口
interface FeishuTokenResponse {
  code: number;
  msg: string;
  data?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
}

// 飞书用户信息响应接口
interface FeishuUserResponse {
  code: number;
  msg: string;
  data?: {
    user: FeishuUserInfo;
  };
}

interface FeishuLoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    departmentId: string | null;
    avatar: string | null;
    feishuUserId: string | null;
  };
}

@Injectable()
export class FeishuService {
  private readonly logger = new Logger(FeishuService.name);
  private readonly loginTickets = new Map<
    string,
    { expiresAt: number; payload: FeishuLoginResult }
  >();
  
  // 飞书应用配置
  private readonly appId: string;
  private readonly appSecret: string;
  private readonly redirectUri: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.appId = this.configService.get<string>('FEISHU_APP_ID', '');
    this.appSecret = this.configService.get<string>('FEISHU_APP_SECRET', '');
    this.redirectUri = this.configService.get<string>('FEISHU_REDIRECT_URI', '');
  }

  /**
   * 获取飞书授权登录URL
   */
  getAuthUrl(state: string): string {
    const baseUrl = 'https://open.feishu.cn/open-apis/authen/v1/authorize';
    const params = new URLSearchParams({
      app_id: this.appId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'contact:user.email:readonly contact:user.phone:readonly',
    });
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * 创建一次性登录 ticket，避免通过 URL 传递 accessToken
   */
  createLoginTicket(payload: FeishuLoginResult): string {
    const ticket = randomUUID();
    const expiresAt = Date.now() + 60 * 1000; // 1 分钟有效
    this.loginTickets.set(ticket, { expiresAt, payload });
    this.cleanupExpiredTickets();
    return ticket;
  }

  /**
   * 交换一次性 ticket
   */
  exchangeLoginTicket(ticket: string): FeishuLoginResult {
    const entry = this.loginTickets.get(ticket);
    if (!entry) {
      throw new UnauthorizedException('登录票据无效或已失效');
    }

    this.loginTickets.delete(ticket);

    if (entry.expiresAt < Date.now()) {
      throw new UnauthorizedException('登录票据已过期');
    }

    return entry.payload;
  }

  /**
   * 清理过期票据，避免内存增长
   */
  private cleanupExpiredTickets(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.loginTickets.entries()) {
      if (entry.expiresAt < now) {
        this.loginTickets.delete(ticket);
      }
    }
  }

  /**
   * 获取飞书应用访问令牌 (app_access_token)
   */
  private async getAppAccessToken(): Promise<string> {
    const url = 'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });

    const data = await response.json();
    
    if (data.code !== 0) {
      this.logger.error('获取飞书 app_access_token 失败', data);
      throw new UnauthorizedException('飞书认证失败');
    }

    return data.app_access_token;
  }

  /**
   * 使用授权码获取用户访问令牌
   */
  private async getUserAccessToken(code: string): Promise<FeishuTokenResponse['data']> {
    const appAccessToken = await this.getAppAccessToken();
    
    const url = 'https://open.feishu.cn/open-apis/authen/v1/oidc/access_token';
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
      }),
    });

    const data: FeishuTokenResponse = await response.json();
    
    if (data.code !== 0 || !data.data) {
      this.logger.error('获取飞书用户令牌失败', data);
      throw new UnauthorizedException('飞书授权失败');
    }

    return data.data;
  }

  /**
   * 获取飞书用户信息
   */
  private async getFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
    const url = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const data: FeishuUserResponse = await response.json();
    
    if (data.code !== 0 || !data.data?.user) {
      this.logger.error('获取飞书用户信息失败', data);
      throw new UnauthorizedException('获取用户信息失败');
    }

    return data.data.user;
  }

  /**
   * 飞书登录/注册
   * 使用授权码完成登录，如果用户不存在则自动创建
   */
  async loginWithFeishu(code: string): Promise<FeishuLoginResult> {
    // 1. 获取用户访问令牌
    const tokenData = await this.getUserAccessToken(code);
    
    // 2. 获取飞书用户信息
    const feishuUser = await this.getFeishuUserInfo(tokenData.access_token);
    
    this.logger.log(`飞书用户登录: ${feishuUser.name} (${feishuUser.open_id})`);

    // 3. 查找或创建本地用户
    let user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { feishuOpenId: feishuUser.open_id },
          { feishuUserId: feishuUser.user_id },
          { email: feishuUser.email },
        ],
      },
    });

    if (!user) {
      // 创建新用户
      user = await this.prisma.user.create({
        data: {
          email: feishuUser.email || `${feishuUser.open_id}@feishu.local`,
          name: feishuUser.name,
          phone: feishuUser.mobile,
          avatar: feishuUser.avatar_url,
          feishuUserId: feishuUser.user_id,
          feishuOpenId: feishuUser.open_id,
          feishuUnionId: feishuUser.union_id,
          role: 'EMPLOYEE', // 默认角色
          isActive: true,
        },
      });
      this.logger.log(`创建新用户: ${user.name} (${user.id})`);
    } else {
      // 更新飞书关联信息
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          feishuUserId: feishuUser.user_id,
          feishuOpenId: feishuUser.open_id,
          feishuUnionId: feishuUser.union_id,
          avatar: feishuUser.avatar_url || user.avatar,
          phone: feishuUser.mobile || user.phone,
        },
      });
      this.logger.log(`更新用户飞书信息: ${user.name} (${user.id})`);
    }

    // 4. 检查用户状态
    if (!user.isActive) {
      throw new UnauthorizedException('账号已被禁用');
    }

    // 5. 生成JWT令牌
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign({
      ...payload,
      type: 'access',
    });
    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
      },
      {
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        avatar: user.avatar,
        feishuUserId: user.feishuUserId,
      },
    };
  }

  /**
   * 绑定飞书账号到现有用户
   */
  async bindFeishuAccount(userId: string, code: string) {
    // 1. 获取飞书用户信息
    const tokenData = await this.getUserAccessToken(code);
    const feishuUser = await this.getFeishuUserInfo(tokenData.access_token);

    // 2. 检查飞书账号是否已被其他用户绑定
    const existingUser = await this.prisma.user.findFirst({
      where: {
        feishuOpenId: feishuUser.open_id,
        NOT: { id: userId },
      },
    });

    if (existingUser) {
      throw new UnauthorizedException('该飞书账号已被其他用户绑定');
    }

    // 3. 绑定飞书账号
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        feishuUserId: feishuUser.user_id,
        feishuOpenId: feishuUser.open_id,
        feishuUnionId: feishuUser.union_id,
      },
    });

    return {
      message: '飞书账号绑定成功',
      feishuUserId: user.feishuUserId,
    };
  }

  /**
   * 解绑飞书账号
   */
  async unbindFeishuAccount(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 如果用户没有密码，不允许解绑（否则无法登录）
    if (!user.password) {
      throw new UnauthorizedException('请先设置密码后再解绑飞书账号');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        feishuUserId: null,
        feishuOpenId: null,
        feishuUnionId: null,
      },
    });

    return { message: '飞书账号解绑成功' };
  }
}
