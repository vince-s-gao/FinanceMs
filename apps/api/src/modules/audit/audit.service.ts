// InfFinanceMs - 审计日志服务

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parseDateRangeEnd, parseDateRangeStart } from '../../common/utils/query.utils';
import { QueryAuditLogDto, AUDIT_ACTION_OPTIONS } from './dto/query-audit-log.dto';

/**
 * 审计日志服务
 * 用于记录系统中的关键操作和安全事件
 */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * 记录审计日志
   * @param userId 操作人ID
   * @param action 操作类型
   * @param entityType 实体类型
   * @param entityId 实体ID
   * @param oldValue 旧值（可选）
   * @param newValue 新值（可选）
   * @param ipAddress IP地址（可选）
   * @param userAgent 用户代理（可选）
   */
  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      // 对敏感数据进行脱敏处理
      const sanitizedOldValue = this.sanitizeSensitiveData(oldValue);
      const sanitizedNewValue = this.sanitizeSensitiveData(newValue);

      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          entityType,
          entityId,
          oldValue: sanitizedOldValue,
          newValue: sanitizedNewValue,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      // 审计日志记录失败不应影响主业务流程
      console.error('审计日志记录失败:', error);
    }
  }

  /**
   * 记录登录事件
   */
  async logLogin(
    userId: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(
      userId,
      success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
      'User',
      userId,
      null,
      { success, timestamp: new Date().toISOString() },
      ipAddress,
      userAgent,
    );
  }

  /**
   * 记录权限拒绝事件
   */
  async logAccessDenied(
    userId: string,
    resource: string,
    action: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(
      userId,
      'ACCESS_DENIED',
      resource,
      userId,
      null,
      { action, timestamp: new Date().toISOString() },
      ipAddress,
      userAgent,
    );
  }

  /**
   * 讦录数据修改事件
   */
  async logDataModification(
    userId: string,
    entityType: string,
    entityId: string,
    oldValue: any,
    newValue: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(
      userId,
      'DATA_MODIFIED',
      entityType,
      entityId,
      oldValue,
      newValue,
      ipAddress,
      userAgent,
    );
  }

  /**
   * 记录敏感操作事件
   */
  async logSensitiveOperation(
    userId: string,
    operation: string,
    entityType: string,
    entityId: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.log(
      userId,
      operation,
      entityType,
      entityId,
      null,
      details,
      ipAddress,
      userAgent,
    );
  }

  /**
   * 对敏感数据进行脱敏处理
   * @param data 原始数据
   * @returns 脱敏后的数据
   */
  private sanitizeSensitiveData(data: any): any {
    if (!data) {
      return data;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeSensitiveData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      const sensitiveFields = [
        'password',
        'token',
        'secret',
        'apiKey',
        'accessToken',
        'refreshToken',
        'bankAccount',
        'idCard',
        'phone',
        'email',
      ];

      for (const [key, value] of Object.entries(data)) {
        if (sensitiveFields.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
          // 对敏感字段进行脱敏
          sanitized[key] = this.maskSensitiveValue(key, value);
        } else {
          sanitized[key] = this.sanitizeSensitiveData(value);
        }
      }

      return sanitized;
    }

    return data;
  }

  /**
   * 对敏感值进行掩码处理
   * @param field 字段名
   * @param value 值
   * @returns 掩码后的值
   */
  private maskSensitiveValue(field: string, value: any): string {
    if (!value || typeof value !== 'string') {
      return '***';
    }

    const fieldLower = field.toLowerCase();

    // 邮箱脱敏：user***@example.com
    if (fieldLower.includes('email')) {
      const atIndex = value.indexOf('@');
      if (atIndex > 0) {
        const prefix = value.substring(0, 2);
        const suffix = value.substring(atIndex);
        return `${prefix}***${suffix}`;
      }
    }

    // 手机号脱敏：138****5678
    if (fieldLower.includes('phone')) {
      if (value.length >= 11) {
        return `${value.substring(0, 3)}****${value.substring(7)}`;
      }
    }

    // 银行账号脱敏：****1234
    if (fieldLower.includes('bank') || fieldLower.includes('account')) {
      if (value.length >= 4) {
        return `****${value.substring(value.length - 4)}`;
      }
    }

    // 其他敏感字段：显示前2位和后2位
    if (value.length > 4) {
      return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
    }

    return '***';
  }

  /**
   * 获取用户的审计日志
   * @param userId 用户ID
   * @param limit 返回数量限制
   */
  async getUserAuditLogs(userId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * 获取实体的审计日志
   * @param entityType 实体类型
   * @param entityId 实体ID
   * @param limit 返回数量限制
   */
  async getEntityAuditLogs(entityType: string, entityId: string, limit: number = 100) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * 分页查询操作日志
   */
  async findAll(query: QueryAuditLogDto) {
    const {
      page = 1,
      pageSize = 20,
      action,
      entityType,
      userId,
      keyword,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * pageSize;
    const where: any = {};

    if (action) where.action = action;
    if (entityType) where.entityType = entityType.toLowerCase();
    if (userId) where.userId = userId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = parseDateRangeStart(startDate);
      if (endDate) where.createdAt.lte = parseDateRangeEnd(endDate);
    }

    if (keyword) {
      where.OR = [
        { entityId: { contains: keyword, mode: 'insensitive' } },
        { user: { is: { name: { contains: keyword, mode: 'insensitive' } } } },
        { user: { is: { email: { contains: keyword, mode: 'insensitive' } } } },
      ];
    }

    const safeSortBy = sortBy === 'createdAt' ? 'createdAt' : 'createdAt';
    const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: safeSortOrder },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getMeta() {
    const entityTypes = await this.prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    });

    return {
      actions: [...AUDIT_ACTION_OPTIONS],
      entityTypes: entityTypes.map((item) => item.entityType).filter(Boolean),
    };
  }
}
