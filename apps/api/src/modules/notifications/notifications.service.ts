import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

interface CreateNotificationInput {
  userId: string;
  title: string;
  content: string;
  type?: 'SYSTEM' | 'APPROVAL' | 'PAYMENT' | 'ALERT';
  link?: string;
  metadata?: unknown;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        content: input.content,
        type: input.type || 'SYSTEM',
        link: input.link,
        metadata: input.metadata as any,
      },
    });
  }

  async createForUsers(userIds: string[], payload: Omit<CreateNotificationInput, 'userId'>) {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({
      data: uniqueIds.map((userId) => ({
        userId,
        title: payload.title,
        content: payload.content,
        type: payload.type || 'SYSTEM',
        link: payload.link,
        metadata: payload.metadata as any,
      })),
    });
  }

  async findMine(userId: string, query: QueryNotificationDto) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const unreadOnly = query.unreadOnly === 'true';
    const where = {
      userId,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUnreadCount(userId: string) {
    const unreadCount = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
    return { unreadCount };
  }

  async markAsRead(userId: string, id: string) {
    const item = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, isRead: true },
    });
    if (!item) {
      throw new NotFoundException('通知不存在');
    }
    if (item.isRead) {
      return this.prisma.notification.findUnique({ where: { id } });
    }
    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return { updatedCount: result.count };
  }
}
