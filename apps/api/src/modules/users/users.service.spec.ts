import * as bcrypt from "bcryptjs";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { UsersService } from "./users.service";

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
}));

describe("UsersService", () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new UsersService(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (bcrypt.hash as jest.Mock).mockReset();
  });

  it("should apply filters and pagination in findAll", async () => {
    prisma.user.findMany.mockResolvedValueOnce([{ id: "u1" }]);
    prisma.user.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      role: "ADMIN",
      isActive: true,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: "ADMIN", isActive: true },
        skip: 10,
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
  });

  it("should use default pagination in findAll when params are empty", async () => {
    await service.findAll({} as any);

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it("should throw when creating user with duplicated email", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "existing" });

    await expect(
      service.create({
        email: "dup@example.com",
        password: "123456",
        name: "Dup",
        role: "EMPLOYEE",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should hash password and normalize empty departmentId on create", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: "u2",
      email: "new@example.com",
    });
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashed-password");

    await service.create({
      email: "new@example.com",
      password: "123456",
      name: "New User",
      phone: "13800000000",
      role: "EMPLOYEE",
      departmentId: "",
    } as any);

    expect(bcrypt.hash).toHaveBeenCalledWith("123456", 10);
    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          password: "hashed-password",
          departmentId: null,
        }),
      }),
    );
  });

  it("should throw when updating non-existing user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.update("missing", { name: "Updated" } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("should hash updated password and keep departmentId nullable", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    prisma.user.update.mockResolvedValueOnce({ id: "u1" });
    (bcrypt.hash as jest.Mock).mockResolvedValueOnce("hashed-update");

    await service.update("u1", {
      password: "new-password",
      departmentId: "",
      name: "Updated",
    } as any);

    expect(bcrypt.hash).toHaveBeenCalledWith("new-password", 10);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          password: "hashed-update",
          departmentId: null,
          name: "Updated",
        }),
      }),
    );
  });

  it("should disable user in remove", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1", isActive: true });
    prisma.user.update.mockResolvedValueOnce({ id: "u1", isActive: false });

    await service.remove("u1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isActive: false },
    });
  });

  it("should throw when removing current login user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      role: "ADMIN",
      isActive: true,
    });

    await expect(service.remove("u1", "u1")).rejects.toThrow(ConflictException);
  });

  it("should throw when removing last active admin", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      role: "ADMIN",
      isActive: true,
    });
    prisma.user.count.mockResolvedValueOnce(1);

    await expect(service.remove("u1", "u2")).rejects.toThrow(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("should allow removing admin when more than one active admin exists", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      role: "ADMIN",
      isActive: true,
    });
    prisma.user.count.mockResolvedValueOnce(2);
    prisma.user.update.mockResolvedValueOnce({ id: "u1", isActive: false });

    await service.remove("u1", "u2");

    expect(prisma.user.count).toHaveBeenCalledWith({
      where: { role: "ADMIN", isActive: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { isActive: false },
    });
  });

  it("should throw when removing non-existing user", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.remove("missing")).rejects.toThrow(NotFoundException);
  });

  it("should return active user options in getOptions", async () => {
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: "u1",
        name: "Alice",
        email: "alice@example.com",
        role: "ADMIN",
        department: { id: "d1", name: "研发部" },
      },
    ]);

    const result = await service.getOptions();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("u1");
  });
});
