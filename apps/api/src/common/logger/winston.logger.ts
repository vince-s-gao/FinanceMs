// InfFinanceMs - 日志配置

import { WinstonModule, utilities } from "nest-winston";
import * as winston from "winston";
import * as path from "path";
import * as fs from "fs";

// 日志目录
const logDir = path.join(__dirname, "../../logs");
fs.mkdirSync(logDir, { recursive: true });

const LOG_MAX_SIZE = Number(process.env.LOG_MAX_SIZE_BYTES || 5 * 1024 * 1024);
const LOG_MAX_FILES = Number(process.env.LOG_MAX_FILES || 10);

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// 控制台格式
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.ms(),
  utilities.format.nestLike("InfFinanceMs", {
    colors: true,
    prettyPrint: true,
  }),
);

// 开发环境日志配置
const devLogger = WinstonModule.createLogger({
  transports: [
    // 控制台输出
    new winston.transports.Console({
      format: consoleFormat,
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: logFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: logFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
    }),
  ],
});

// 生产环境日志配置
const prodLogger = WinstonModule.createLogger({
  transports: [
    // 控制台输出（简化格式）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: logFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
    }),
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, "combined.log"),
      format: logFormat,
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
    }),
  ],
});

// 导出日志配置
export const logger =
  process.env.NODE_ENV === "production" ? prodLogger : devLogger;
