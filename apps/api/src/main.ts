// InfFinanceMs - NestJS 应用入口

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { logger } from "./common/logger/winston.logger";
import { AuditService } from "./modules/audit/audit.service";
import { AuditLogInterceptor } from "./common/interceptors/audit-log.interceptor";
import { TrimStringsPipe } from "./common/pipes/trim-strings.pipe";
import { NextFunction, Request, Response } from "express";

function parseDurationToSeconds(value: string | undefined): number | null {
  if (!value) return null;
  const matched = value.trim().match(/^(\d+)([smhd])$/i);
  if (!matched) return null;
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

function validateCriticalEnv(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const requiredInAnyEnv = ["JWT_SECRET"];
  const requiredInProduction = ["DATABASE_URL", "JWT_EXPIRES_IN"];
  const refreshExpires =
    process.env.JWT_REFRESH_EXPIRES_IN ||
    process.env.JWT_REFRESH_TOKEN_EXPIRES_IN;

  const missing = requiredInAnyEnv.filter((key) => !process.env[key]?.trim());

  if (isProduction) {
    missing.push(
      ...requiredInProduction.filter((key) => !process.env[key]?.trim()),
    );
    if (!refreshExpires?.trim()) {
      missing.push("JWT_REFRESH_EXPIRES_IN|JWT_REFRESH_TOKEN_EXPIRES_IN");
    }
  }

  if (missing.length > 0) {
    throw new Error(`缺少关键环境变量: ${missing.join(", ")}`);
  }

  const weakJwtSecret =
    (process.env.JWT_SECRET || "").trim().toLowerCase() === "your_jwt_secret";
  if (isProduction && weakJwtSecret) {
    throw new Error("生产环境禁止使用默认 JWT_SECRET，请设置强随机密钥");
  }

  if (isProduction) {
    const accessExpireSeconds = parseDurationToSeconds(
      process.env.JWT_EXPIRES_IN,
    );
    if (accessExpireSeconds && accessExpireSeconds > 24 * 3600) {
      throw new Error("生产环境 JWT_EXPIRES_IN 不应超过 24 小时");
    }
  }
}

async function bootstrap() {
  validateCriticalEnv();

  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });
  const isProduction = process.env.NODE_ENV === "production";

  // 全局前缀
  app.setGlobalPrefix("api");

  // 全局验证管道
  app.useGlobalPipes(
    new TrimStringsPipe(),
    new ValidationPipe({
      whitelist: true, // 自动剥离非白名单属性
      forbidNonWhitelisted: true, // 非白名单属性抛出错误
      transform: true, // 自动类型转换
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局异常过滤器
  app.useGlobalFilters(new HttpExceptionFilter());

  // 全局审计日志拦截器（仅记录登录/增删改，不记录浏览日志）
  app.useGlobalInterceptors(new AuditLogInterceptor(app.get(AuditService)));

  // HTTP 请求访问日志（用于问题追踪与性能观测）
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      logger.log(
        `[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms - ${req.ip || "-"}`,
      );
    });
    next();
  });

  // 生产环境强制 HTTPS（支持反向代理 x-forwarded-proto）
  const forceHttps = process.env.FORCE_HTTPS
    ? process.env.FORCE_HTTPS === "true"
    : isProduction;
  if (forceHttps) {
    const expressInstance = app.getHttpAdapter().getInstance();
    if (typeof expressInstance?.set === "function") {
      expressInstance.set("trust proxy", true);
    }
    app.use((req: Request, res: Response, next: NextFunction) => {
      const forwardedProtoHeader = req.headers["x-forwarded-proto"];
      const forwardedProto = Array.isArray(forwardedProtoHeader)
        ? forwardedProtoHeader[0]
        : forwardedProtoHeader;
      const firstForwardedProto = String(forwardedProto || "")
        .split(",")[0]
        ?.trim()
        .toLowerCase();
      const isHttps = req.secure || firstForwardedProto === "https";
      if (isHttps) {
        next();
        return;
      }

      const host = req.headers.host;
      if (!host) {
        next();
        return;
      }
      res.redirect(308, `https://${host}${req.originalUrl || req.url}`);
    });
  }

  // 安全头配置
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      hsts: {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  // 速率限制配置 - 开发环境放宽限制
  const isDev = !isProduction;

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: isDev ? 1000 : 100, // 开发环境：1000次，生产环境：100次
    message: {
      message: "请求过于频繁，请稍后再试",
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // 登录接口更严格的速率限制
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: isDev ? 50 : 5, // 开发环境：50次，生产环境：5次
    message: {
      message: "登录尝试过于频繁，请15分钟后再试",
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/feishu/login", authLimiter);
  app.use("/api/auth/feishu/exchange-ticket", authLimiter);

  const configuredCorsOrigins = (
    process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:43001"
  )
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const localCorsOrigins = [
    "http://localhost:3000",
    "http://localhost:43001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:43001",
  ];
  const corsOrigins = Array.from(
    new Set([...configuredCorsOrigins, ...localCorsOrigins]),
  );

  // CORS配置
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-CSRF-Token",
      "X-Skip-Auth-Refresh",
    ],
  });

  // Swagger API文档
  const config = new DocumentBuilder()
    .setTitle("InfFinanceMs API")
    .setDescription("InfFinanceMs财务管理系统 API 文档")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  // 启动服务
  const port = process.env.API_PORT || 3001;
  const host = process.env.API_HOST || "0.0.0.0";
  await app.listen(port, host);

  logger.log("🚀 InfFinanceMs API 服务已启动");
  logger.log(
    `📡 服务地址: http://localhost:${port} / http://127.0.0.1:${port}`,
  );
  logger.log(`📚 API文档: http://127.0.0.1:${port}/api/docs`);
  logger.log("🔒 安全配置已启用：速率限制、安全头、CORS");
}

bootstrap();
