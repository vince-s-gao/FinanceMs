// InfFinanceMs - 全局异常过滤器

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { sanitizeRequestUrl } from "../utils/request-sanitizer.utils";

interface HttpExceptionResponsePayload {
  message?: string | string[];
  error?: string;
  code?: string;
  details?: unknown;
}

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apiKey",
  "accessToken",
  "refreshToken",
] as const;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  private isSensitiveKey(key: string): boolean {
    const lowered = key.toLowerCase();
    return SENSITIVE_KEYS.some((item) => lowered.includes(item.toLowerCase()));
  }

  private sanitizeText(text: string): string {
    return text
      .replace(/(Bearer\\s+)[A-Za-z0-9\\-_.]+/gi, "$1***")
      .replace(
        /((?:access|refresh)?token\\s*[:=]\\s*)[A-Za-z0-9\\-_.]+/gi,
        "$1***",
      )
      .replace(/(password\\s*[:=]\\s*)[^\\s,;]+/gi, "$1***")
      .replace(/(secret\\s*[:=]\\s*)[^\\s,;]+/gi, "$1***");
  }

  private sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return this.sanitizeText(value);
    if (typeof value !== "object") return value;
    if (Array.isArray(value))
      return value.map((item) => this.sanitizeValue(item));

    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(
      value as Record<string, unknown>,
    )) {
      result[key] = this.isSensitiveKey(key) ? "***" : this.sanitizeValue(item);
    }
    return result;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const safeRequestPath = sanitizeRequestUrl(request.url);

    let status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[] = "服务器内部错误";
    let error = "Internal Server Error";
    let code = `HTTP_${status}`;
    let details: unknown;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object") {
        const responseObj = exceptionResponse as HttpExceptionResponsePayload;
        message = responseObj.message || message;
        error = responseObj.error || error;
        code = responseObj.code || code;
        details = responseObj.details;
      }
    } else if (exception instanceof Error) {
      const errnoException = exception as NodeJS.ErrnoException;
      // 静态附件缺失属于资源不存在，返回 404，避免误报 500
      if (
        errnoException.code === "ENOENT" &&
        request.url.startsWith("/uploads/")
      ) {
        status = HttpStatus.NOT_FOUND;
        error = "Not Found";
        code = `HTTP_${status}`;
        message = "附件不存在或已被删除";
      } else {
        message = exception.message;
      }
    }

    // 生产环境下隐藏详细错误信息
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = "服务器内部错误，请稍后重试";
      details = undefined;
    }

    const sanitizedMessage = Array.isArray(message)
      ? message.map((item) => this.sanitizeText(String(item)))
      : this.sanitizeText(String(message));
    const sanitizedDetails = this.sanitizeValue(details);
    const sanitizedStack =
      exception instanceof Error && exception.stack
        ? this.sanitizeText(exception.stack)
        : undefined;

    // 记录错误日志
    this.logger.error(
      `${request.method} ${safeRequestPath} - Status: ${status} - Message: ${Array.isArray(sanitizedMessage) ? sanitizedMessage.join("; ") : sanitizedMessage}`,
      sanitizedStack,
    );

    // 返回统一的错误响应
    const errorResponse = {
      code,
      message: sanitizedMessage,
      details: sanitizedDetails,
    };

    response.status(status).json({
      statusCode: status,
      error,
      timestamp: new Date().toISOString(),
      path: safeRequestPath,
      ...errorResponse,
    });
  }
}
