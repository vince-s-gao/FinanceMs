import { NotFoundException } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let service: NotificationsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn().mockResolvedValue({ id: "n1" }),
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([{ id: "n1", isRead: false }]),
        findFirst: jest.fn().mockResolvedValue({ id: "n1", isRead: false }),
        findUnique: jest.fn().mockResolvedValue({ id: "n1", isRead: true }),
        update: jest.fn().mockResolvedValue({ id: "n1", isRead: true }),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    service = new NotificationsService(prisma);
  });

  it("should create single notification", async () => {
    await service.createNotification({
      userId: "u1",
      title: "标题",
      content: "内容",
      type: "SYSTEM",
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "u1",
          title: "标题",
        }),
      }),
    );
  });

  it("should default type to SYSTEM when creating single notification", async () => {
    await service.createNotification({
      userId: "u1",
      title: "默认类型",
      content: "内容",
    });
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "SYSTEM",
        }),
      }),
    );
  });

  it("should create notifications for unique users", async () => {
    const result = await service.createForUsers(["u1", "u1", "u2"], {
      title: "待审批",
      content: "有新的申请",
      type: "APPROVAL",
    });
    expect(result.count).toBe(2);
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "u1" }),
          expect.objectContaining({ userId: "u2" }),
        ]),
      }),
    );
  });

  it("should default type and filter falsy user ids in createForUsers", async () => {
    await service.createForUsers(["u1", "", "u2", undefined as any], {
      title: "默认类型批量通知",
      content: "内容",
    });
    expect(prisma.notification.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({ userId: "u1", type: "SYSTEM" }),
          expect.objectContaining({ userId: "u2", type: "SYSTEM" }),
        ],
      }),
    );
  });

  it("should skip createMany when user list is empty", async () => {
    const result = await service.createForUsers([], {
      title: "空用户",
      content: "无目标用户",
    });
    expect(result.count).toBe(0);
    expect(prisma.notification.createMany).not.toHaveBeenCalled();
  });

  it("should return paginated list and unread count", async () => {
    const list = await service.findMine("u1", {
      page: 1,
      pageSize: 10,
      unreadOnly: "true",
    } as any);
    const unread = await service.getUnreadCount("u1");

    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe("n1");
    expect(unread.unreadCount).toBe(1);
  });

  it("should query all notifications when unreadOnly is false", async () => {
    await service.findMine("u1", {
      page: 2,
      pageSize: 5,
      unreadOnly: "false",
    } as any);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u1" },
        skip: 5,
        take: 5,
      }),
    );
  });

  it("should fallback to default pagination values", async () => {
    const result = await service.findMine("u1", {} as any);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });

  it("should mark one as read", async () => {
    const item = await service.markAsRead("u1", "n1");
    expect(item.isRead).toBe(true);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "n1" },
        data: expect.objectContaining({
          isRead: true,
          readAt: expect.any(Date),
        }),
      }),
    );
  });

  it("should return existing record when notification is already read", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: "n1",
      isRead: true,
    });
    const result = await service.markAsRead("u1", "n1");
    expect(prisma.notification.update).not.toHaveBeenCalled();
    expect(prisma.notification.findUnique).toHaveBeenCalledWith({
      where: { id: "n1" },
    });
    expect(result.id).toBe("n1");
  });

  it("should throw when marking missing notification", async () => {
    prisma.notification.findFirst.mockResolvedValueOnce(null);
    await expect(service.markAsRead("u1", "missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should mark all unread as read", async () => {
    const result = await service.markAllAsRead("u1");
    expect(result.updatedCount).toBe(3);
  });
});
