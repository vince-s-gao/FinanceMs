import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import * as path from "path";

export const MAX_UPLOAD_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function normalizeExtensions(allowedExtensions: string[]): Set<string> {
  return new Set(allowedExtensions.map((item) => item.toLowerCase()));
}

function createExtensionFilter(allowedExtensions: string[]) {
  const allowed = normalizeExtensions(allowedExtensions);
  return (
    _req: unknown,
    file: Express.Multer.File,
    cb: (error: any, acceptFile: boolean) => void,
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
