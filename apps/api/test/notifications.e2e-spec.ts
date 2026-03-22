import { Test } from "@nestjs/testing";
import { NotificationsController } from "../src/modules/notifications/notifications.controller";
import { NotificationsService } from "../src/modules/notifications/notifications.service";

describe("NotificationsController Flow (e2e-like)", () => {
  let controller: NotificationsController;

  const serviceMock = {
    findMine: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(NotificationsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should query notification list with current user", async () => {
    serviceMock.findMine.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 1, pageSize: 20, unreadOnly: "true" } as any;
    const result = await controller.findMine({ id: "u1" }, query);

    expect(serviceMock.findMine).toHaveBeenCalledWith("u1", query);
    expect(result.total).toBe(0);
  });

  it("should return unread count", async () => {
    serviceMock.getUnreadCount.mockResolvedValueOnce({ unreadCount: 3 });
    const result = await controller.getUnreadCount({ id: "u1" });
    expect(serviceMock.getUnreadCount).toHaveBeenCalledWith("u1");
    expect(result.unreadCount).toBe(3);
  });

  it("should mark one/all notifications as read", async () => {
    serviceMock.markAsRead.mockResolvedValueOnce({ id: "n1", isRead: true });
    serviceMock.markAllAsRead.mockResolvedValueOnce({ updatedCount: 5 });

    const one = await controller.markAsRead({ id: "u1" }, "n1");
    const all = await controller.markAllAsRead({ id: "u1" });

    expect(serviceMock.markAsRead).toHaveBeenCalledWith("u1", "n1");
    expect(serviceMock.markAllAsRead).toHaveBeenCalledWith("u1");
    expect(one.isRead).toBe(true);
    expect(all.updatedCount).toBe(5);
  });
});
