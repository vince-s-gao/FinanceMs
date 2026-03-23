import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import * as path from "path";

export const MAX_UPLOAD_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const EXTENSION_MIME_WHITELIST: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".gif": ["image/gif"],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".csv": ["text/csv", "application/csv", "application/vnd.ms-excel"],
};

function normalizeExtensions(allowedExtensions: string[]): Set<string> {
  return new Set(allowedExtensions.map((item) => item.toLowerCase()));
}

function normalizeMimeType(mimeType: string | undefined): string {
  return String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isStrictMimeCheckEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

function createExtensionFilter(allowedExtensions: string[]) {
  const allowed = normalizeExtensions(allowedExtensions);
  return (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!ext || !allowed.has(ext)) {
      cb(
        new BadRequestException(
          `不支持的文件类型，仅支持：${Array.from(allowed).join(", ")}`,
        ),
        false,
      );
      return;
    }

    const actualMimeType = normalizeMimeType(file.mimetype);
    const allowedMimeTypes = new Set(
      (EXTENSION_MIME_WHITELIST[ext] || []).map((item) => item.toLowerCase()),
    );
    const strictMimeCheck = isStrictMimeCheckEnabled();

    if (strictMimeCheck && allowedMimeTypes.size > 0) {
      if (
        !actualMimeType ||
        actualMimeType === "application/octet-stream" ||
        !allowedMimeTypes.has(actualMimeType)
      ) {
        cb(
          new BadRequestException(
            `文件MIME类型不匹配（${ext}），请上传正确格式文件`,
          ),
          false,
        );
        return;
      }
    }

    cb(null, true);
  };
}

export function buildSingleFileInterceptorOptions(
  allowedExtensions: string[],
): MulterOptions {
  return {
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE,
      files: 1,
    },
    fileFilter: createExtensionFilter(allowedExtensions),
  };
}

export function buildMultiFileInterceptorOptions(
  maxFileCount: number,
  allowedExtensions: string[],
): MulterOptions {
  return {
    limits: {
      fileSize: MAX_UPLOAD_FILE_SIZE,
      files: maxFileCount,
    },
    fileFilter: createExtensionFilter(allowedExtensions),
  };
}
