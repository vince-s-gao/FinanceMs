// InfFinanceMs - 文件上传服务

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * 文件魔数映射表（用于验证文件内容）
 */
const FILE_MAGIC_NUMBERS: Record<string, number[]> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF], // JPEG
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], // PNG
  'image/gif': [0x47, 0x49, 0x46, 0x38], // GIF
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP)
};

/**
 * 允许的文件分类
 */
const ALLOWED_CATEGORIES = ['contracts', 'invoices', 'expenses', 'temp'];

@Injectable()
export class UploadService {
  private uploadDir: string;

  constructor(private configService: ConfigService) {
    // 上传目录，默认为 uploads
    this.uploadDir = this.configService.get('UPLOAD_DIR') || 'uploads';
    // 确保上传目录存在
    this.ensureUploadDir();
  }

  /**
   * 确保上传目录存在
   */
  private ensureUploadDir() {
    const fullPath = path.resolve(this.uploadDir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    // 创建子目录
    const subDirs = ALLOWED_CATEGORIES;
    subDirs.forEach((dir) => {
      const subPath = path.join(fullPath, dir);
      if (!fs.existsSync(subPath)) {
        fs.mkdirSync(subPath, { recursive: true });
      }
    });
  }

  /**
   * 验证文件魔数（文件内容验证）
   * @param buffer 文件缓冲区
   * @param mimeType 声明的 MIME 类型
   */
  private validateFileMagicNumber(buffer: Buffer, mimeType: string): boolean {
    const expectedMagic = FILE_MAGIC_NUMBERS[mimeType];
    if (!expectedMagic) {
      return false;
    }

    // 检查文件开头是否匹配魔数
    for (let i = 0; i < expectedMagic.length; i++) {
      if (buffer[i] !== expectedMagic[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 验证文件扩展名是否与 MIME 类型匹配
   * @param filename 文件名
   * @param mimeType MIME 类型
   */
  private validateFileExtension(filename: string, mimeType: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    const mimeToExt: Record<string, string[]> = {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    };

    const allowedExts = mimeToExt[mimeType] || [];
    return allowedExts.includes(ext);
  }

  private filenameScore(value: string): number {
    const cjkCount = (value.match(/[\u4e00-\u9fff]/g) || []).length;
    const replacementCount = (value.match(/\uFFFD/g) || []).length;
    const mojibakeHintCount = (value.match(/[ÃÂ]/g) || []).length;
    return cjkCount * 3 - replacementCount * 4 - mojibakeHintCount * 2;
  }

  /**
   * 标准化上传文件名，优先修复 UTF-8 被按 latin1 解析导致的中文乱码
   */
  private normalizeOriginalFileName(originalName: string): string {
    const baseName = path.basename(originalName || '').trim() || 'file';
    const decoded = Buffer.from(baseName, 'latin1').toString('utf8').trim();
    if (!decoded) return baseName;
    return this.filenameScore(decoded) > this.filenameScore(baseName)
      ? decoded.normalize('NFC')
      : baseName;
  }

  /**
   * 清理路径，防止路径遍历攻击
   * @param inputPath 输入路径
   */
  private sanitizePath(inputPath: string): string {
    // 移除所有 .. 和绝对路径
    return inputPath
      .replace(/\.\./g, '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');
  }

  /**
   * 保存上传的文件
   * @param file 上传的文件
   * @param category 文件分类（contracts/invoices/expenses）
   * @returns 文件信息
   */
  async saveFile(
    file: Express.Multer.File,
    category: string = 'temp',
  ): Promise<{ url: string; filename: string; originalName: string; size: number }> {
    const normalizedOriginalName = this.normalizeOriginalFileName(file.originalname);

    // 验证文件分类
    if (!ALLOWED_CATEGORIES.includes(category)) {
      throw new BadRequestException('无效的文件分类');
    }

    // 验证文件类型
    const allowedMimeTypes = Object.keys(FILE_MAGIC_NUMBERS);
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('不支持的文件类型，仅支持 PDF、图片、Word 文档');
    }

    // 验证文件扩展名
    if (!this.validateFileExtension(normalizedOriginalName, file.mimetype)) {
      throw new BadRequestException('文件扩展名与文件类型不匹配');
    }

    // 验证文件大小（最大 100MB）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException('文件大小不能超过 100MB');
    }

    // 验证文件内容（魔数检查）
    if (!this.validateFileMagicNumber(file.buffer, file.mimetype)) {
      throw new BadRequestException('文件内容与声明的类型不匹配，可能存在伪造');
    }

    // 生成唯一文件名
    const ext = path.extname(normalizedOriginalName);
    const filename = `${randomUUID()}${ext}`;
    
    // 清理路径，防止路径遍历
    const sanitizedCategory = this.sanitizePath(category);
    const relativePath = path.join(sanitizedCategory, filename);
    const fullPath = path.join(this.uploadDir, relativePath);

    // 验证最终路径在上传目录内
    const resolvedUploadDir = path.resolve(this.uploadDir);
    const resolvedFullPath = path.resolve(fullPath);
    if (!resolvedFullPath.startsWith(resolvedUploadDir)) {
      throw new BadRequestException('无效的文件路径');
    }

    // 兜底创建目录，避免目录缺失导致 ENOENT
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

    // 保存文件
    fs.writeFileSync(fullPath, file.buffer);

    // 返回文件信息
    return {
      url: `/uploads/${relativePath}`,
      filename,
      originalName: normalizedOriginalName,
      size: file.size,
    };
  }

  /**
   * 删除文件
   * @param fileUrl 文件URL
   * @param userId 用户ID（用于权限验证）
   */
  async deleteFile(fileUrl: string, userId?: string): Promise<void> {
    if (!fileUrl) return;

    // 清理路径，防止路径遍历
    const relativePath = this.sanitizePath(fileUrl.replace(/^\/uploads\//, ''));
    const fullPath = path.join(this.uploadDir, relativePath);

    // 验证最终路径在上传目录内
    const resolvedUploadDir = path.resolve(this.uploadDir);
    const resolvedFullPath = path.resolve(fullPath);
    if (!resolvedFullPath.startsWith(resolvedUploadDir)) {
      throw new BadRequestException('无效的文件路径');
    }

    // TODO: 在实际应用中，应该验证用户是否有权限删除该文件
    // 可以通过查询数据库中的文件记录来验证所有权
    // if (userId && !await this.checkFileOwnership(fileUrl, userId)) {
    //   throw new ForbiddenException('无权删除此文件');
    // }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  /**
   * 获取文件的完整路径
   * @param fileUrl 文件URL
   */
  getFilePath(fileUrl: string): string {
    // 清理路径，防止路径遍历
    const relativePath = this.sanitizePath(fileUrl.replace(/^\/uploads\//, ''));
    const fullPath = path.join(this.uploadDir, relativePath);

    // 验证最终路径在上传目录内
    const resolvedUploadDir = path.resolve(this.uploadDir);
    const resolvedFullPath = path.resolve(fullPath);
    if (!resolvedFullPath.startsWith(resolvedUploadDir)) {
      throw new BadRequestException('无效的文件路径');
    }

    return fullPath;
  }
}
