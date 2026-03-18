// InfFinanceMs - NestJS 应用入口

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { logger } from './common/logger/winston.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: logger,
  });

  // 全局前缀
  app.setGlobalPrefix('api');

  // 全局验证管道
  app.useGlobalPipes(
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

  // 安全头配置
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
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
  const isDev = process.env.NODE_ENV !== 'production';
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: isDev ? 1000 : 100, // 开发环境：1000次，生产环境：100次
    message: {
      message: '请求过于频繁，请稍后再试',
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
      message: '登录尝试过于频繁，请15分钟后再试',
      statusCode: 429,
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/feishu/login', authLimiter);
  app.use('/api/auth/feishu/exchange-ticket', authLimiter);

  const corsOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:43001')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  // CORS配置
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Skip-Auth-Refresh'],
  });

  // Swagger API文档
  const config = new DocumentBuilder()
    .setTitle('InfFinanceMs API')
    .setDescription('InfFinanceMs财务管理系统 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // 启动服务
  const port = process.env.API_PORT || 3001;
  await app.listen(port);
  
  logger.log('🚀 InfFinanceMs API 服务已启动');
  logger.log(`📡 服务地址: http://localhost:${port}`);
  logger.log(`📚 API文档: http://localhost:${port}/api/docs`);
  logger.log('🔒 安全配置已启用：速率限制、安全头、CORS');
}

bootstrap();
