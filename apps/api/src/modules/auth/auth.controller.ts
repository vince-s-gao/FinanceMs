// InfFinanceMs - 认证控制器

import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  SetMetadata,
  Query,
  Res,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { FeishuService } from "./feishu.service";
import { LoginDto } from "./dto/login.dto";
import { FeishuLoginDto } from "./dto/feishu-login.dto";
import { ExchangeFeishuTicketDto } from "./dto/exchange-feishu-ticket.dto";
import { JwtAuthGuard } from "../../common/guards";
import { CurrentUser } from "../../common/decorators";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { ERROR_CODE } from "@inffinancems/shared";
import { AuditService } from "../audit/audit.service";

// 公开接口装饰器
const Public = () => SetMetadata("isPublic", true);

@ApiTags("认证")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly feishuService: FeishuService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  private isProduction() {
    return this.configService.get<string>("NODE_ENV") === "production";
  }

  private parseDurationToSeconds(
    value: string,
    fallbackSeconds: number,
  ): number {
    const matched = value.match(/^(\d+)([smhd])$/i);
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

  private getRefreshExpiresIn(): string {
    return (
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") ||
      this.configService.get<string>("JWT_REFRESH_TOKEN_EXPIRES_IN") ||
      "30d"
    );
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const secure = this.isProduction();
    const accessMaxAge = this.parseDurationToSeconds(
      this.configService.get<string>("JWT_EXPIRES_IN", "2h"),
      2 * 3600,
    );
    const refreshMaxAge = this.parseDurationToSeconds(
      this.getRefreshExpiresIn(),
      30 * 24 * 3600,
    );
    const csrfToken = randomBytes(24).toString("hex");

    res.cookie("accessToken", tokens.accessToken, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      maxAge: accessMaxAge * 1000,
      path: "/",
    });
    res.cookie("refreshToken", tokens.refreshToken, {
      httpOnly: true,
      secure,
      sameSite: "strict",
      maxAge: refreshMaxAge * 1000,
      path: "/",
    });
    res.cookie("csrfToken", csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      maxAge: refreshMaxAge * 1000,
      path: "/",
    });
  }

  private clearAuthCookies(res: Response) {
    const secure = this.isProduction();
    res.clearCookie("accessToken", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "lax",
    });
    res.clearCookie("refreshToken", {
      path: "/",
      httpOnly: true,
      secure,
      sameSite: "strict",
    });
    res.clearCookie("csrfToken", {
      path: "/",
      httpOnly: false,
      secure,
      sameSite: "lax",
    });
  }

  private getCookieValue(
    cookieHeader: string | undefined,
    name: string,
  ): string | undefined {
    if (!cookieHeader) return undefined;
    const target = cookieHeader
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`));
    if (!target) return undefined;
    return decodeURIComponent(target.substring(name.length + 1));
  }

  private async logLogin(user: { id: string; email: string }, req: Request) {
    const userAgent = req.headers["user-agent"];
    await this.auditService.log(
      user.id,
      "LOGIN",
      "auth",
      user.id,
      null,
      { email: user.email },
      req.ip,
      typeof userAgent === "string" ? userAgent : undefined,
    );
  }

  @Public()
  @Post("login")
  @ApiOperation({ summary: "用户登录（邮箱密码）" })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);
    this.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await this.logLogin(result.user, req);
    return {
      user: result.user,
    };
  }

  // ==================== 飞书登录相关接口 ====================

  @Public()
  @Get("feishu/url")
  @ApiOperation({ summary: "获取飞书授权登录URL" })
  getFeishuAuthUrl(@Res({ passthrough: true }) res: Response) {
    const state = randomBytes(24).toString("hex");
    const url = this.feishuService.getAuthUrl(state);
    const isProduction =
      this.configService.get<string>("NODE_ENV") === "production";
    res.cookie("feishu_oauth_state", state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
      path: "/api/auth/feishu",
    });
    return { url };
  }

  @Public()
  @Get("feishu/callback")
  @ApiOperation({ summary: "飞书授权回调（重定向方式）" })
  async feishuCallback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.configService.get<string>(
      "FRONTEND_URL",
      "http://localhost:3000",
    );
    const stateInCookie = this.getCookieValue(
      req.headers.cookie,
      "feishu_oauth_state",
    );

    // 清除一次性 state cookie
    res.clearCookie("feishu_oauth_state", {
      path: "/api/auth/feishu",
    });

    if (!state || !stateInCookie || state !== stateInCookie) {
      res.redirect(`${frontendUrl}/login?error=feishu_state_invalid`);
      return;
    }

    try {
      const result = await this.feishuService.loginWithFeishu(code);
      const ticket = this.feishuService.createLoginTicket(result);
      res.redirect(`${frontendUrl}/login/callback?ticket=${ticket}`);
    } catch (error) {
      res.redirect(`${frontendUrl}/login?error=feishu_auth_failed`);
    }
  }

  @Public()
  @Post("feishu/login")
  @ApiOperation({ summary: "飞书登录（前端传递授权码）" })
  async feishuLogin(
    @Body() feishuLoginDto: FeishuLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const result = await this.feishuService.loginWithFeishu(
      feishuLoginDto.code,
    );
    this.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await this.logLogin(result.user, req);
    return {
      user: result.user,
    };
  }

  @Public()
  @Post("feishu/exchange-ticket")
  @ApiOperation({ summary: "使用一次性 ticket 交换登录令牌" })
  async exchangeFeishuTicket(
    @Body() exchangeDto: ExchangeFeishuTicketDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<any> {
    const result = this.feishuService.exchangeLoginTicket(exchangeDto.ticket);
    this.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    await this.logLogin(result.user, req);
    return {
      user: result.user,
    };
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "刷新访问令牌" })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.getCookieValue(
      req.headers.cookie,
      "refreshToken",
    );
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: ERROR_CODE.AUTH_REFRESH_TOKEN_MISSING,
        message: "缺少刷新令牌",
      });
    }
    const result = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });
    return {
      user: result.user,
    };
  }

  @Public()
  @Get("csrf")
  @ApiOperation({ summary: "获取或刷新 CSRF Token" })
  getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const secure = this.isProduction();
    const csrfToken = randomBytes(24).toString("hex");
    res.cookie("csrfToken", csrfToken, {
      httpOnly: false,
      secure,
      sameSite: "lax",
      maxAge: 30 * 24 * 3600 * 1000,
      path: "/",
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post("feishu/bind")
  @ApiBearerAuth()
  @ApiOperation({ summary: "绑定飞书账号" })
  async bindFeishu(
    @CurrentUser() user: any,
    @Body() feishuLoginDto: FeishuLoginDto,
  ) {
    return this.feishuService.bindFeishuAccount(user.id, feishuLoginDto.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post("feishu/unbind")
  @ApiBearerAuth()
  @ApiOperation({ summary: "解绑飞书账号" })
  async unbindFeishu(@CurrentUser() user: any) {
    return this.feishuService.unbindFeishuAccount(user.id);
  }

  // ==================== 通用接口 ====================

  @UseGuards(JwtAuthGuard)
  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "获取当前用户信息" })
  async getCurrentUser(@CurrentUser() user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      feishuUserId: user.feishuUserId,
    };
  }

  @Post("logout")
  @ApiOperation({ summary: "用户登出" })
  @Public()
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return { message: "登出成功" };
  }
}
