import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DepartmentsService } from "./departments.service";

describe("DepartmentsService", () => {
  let service: DepartmentsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      department: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new DepartmentsService(prisma);
  });

  it("should build an arbitrary-depth tree and keep sibling sort order", async () => {
    prisma.department.findMany.mockResolvedValue([
      {
        id: "root-b",
        name: "二级根",
        parentId: null,
        sortOrder: 2,
        manager: null,
        _count: { members: 0 },
      },
      {
        id: "deep-4",
        name: "四级节点",
        parentId: "deep-3",
        sortOrder: 1,
        manager: null,
        _count: { members: 0 },
      },
      {
        id: "root-a",
        name: "一级根",
        parentId: null,
        sortOrder: 1,
        manager: null,
        _count: { members: 2 },
      },
      {
        id: "child-a2",
        name: "子部门B",
        parentId: "root-a",
        sortOrder: 2,
        manager: null,
        _count: { members: 1 },
      },
      {
        id: "deep-3",
        name: "三级节点",
        parentId: "child-a2",
        sortOrder: 1,
        manager: null,
        _count: { members: 1 },
      },
      {
        id: "child-a1",
        name: "子部门A",
        parentId: "root-a",
        sortOrder: 1,
        manager: null,
        _count: { members: 3 },
      },
    ]);

    const result = await service.getTree();

    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        manager: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true } },
      },
    });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("root-a");
    expect(result[0].children.map((item: any) => item.id)).toEqual([
      "child-a1",
      "child-a2",
    ]);
    expect(result[0].children[1].children[0].id).toBe("deep-3");
    expect(result[0].children[1].children[0].children[0].id).toBe("deep-4");
  });

  it("should apply filters and pagination in findAll", async () => {
    prisma.department.findMany.mockResolvedValueOnce([{ id: "d1" }]);
    prisma.department.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      keyword: "研发",
      isActive: true,
    } as any);

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("should use default page and pageSize in findAll", async () => {
    prisma.department.findMany.mockResolvedValueOnce([]);
    prisma.department.count.mockResolvedValueOnce(0);

    const result = await service.findAll({} as any);

    expect(prisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 20,
      }),
    );
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.totalPages).toBe(0);
  });

  it("should return active department options", async () => {
    await service.getOptions();

    expect(prisma.department.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  });

  it("should throw when findOne does not exist", async () => {
    prisma.department.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  it("should return department details when findOne succeeds", async () => {
    prisma.department.findUnique.mockResolvedValueOnce({
      id: "d1",
      code: "DEPT0001",
      name: "研发部",
      parent: null,
      children: [],
    });

    const result = await service.findOne("d1");
    expect(result.id).toBe("d1");
    expect(result.name).toBe("研发部");
  });

  it("should reject create when sibling department name already exists", async () => {
    prisma.department.findFirst.mockResolvedValueOnce({ id: "existing" });

    await expect(
      service.create({
        name: "研发部",
        parentId: "p1",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should reject create when parent department does not exist", async () => {
    prisma.department.findFirst.mockResolvedValueOnce(null);
    prisma.department.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create({
        name: "研发部",
        parentId: "missing-parent",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should create department with generated code", async () => {
    prisma.department.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: "DEPT0009" });
    prisma.department.create.mockResolvedValueOnce({ id: "d1" });

    await service.create({
      name: "研发部",
      sortOrder: 3,
      remark: "test",
    } as any);

    expect(prisma.department.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "DEPT0010",
          name: "研发部",
          sortOrder: 3,
        }),
      }),
    );
  });

  it("should retry create when generated department code conflicts", async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    const conflictError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    conflictError.code = "P2002";
    conflictError.meta = { target: ["code"] };
    prisma.department.create
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({ id: "d-retry" });

    await service.create({
      name: "重试部门",
    } as any);

    expect(prisma.department.create).toHaveBeenCalledTimes(2);
  });

  it("should throw business conflict when department code conflicts in all retries", async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    const conflictError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    conflictError.code = "P2002";
    conflictError.meta = { target: ["code"] };
    prisma.department.create.mockRejectedValue(conflictError);

    await expect(
      service.create({
        name: "重试失败部门",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should evaluate isDepartmentCodeConflict helper branches", () => {
    expect((service as any).isDepartmentCodeConflict(new Error("x"))).toBe(
      false,
    );

    const wrongCodeError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    wrongCodeError.code = "P2025";
    wrongCodeError.meta = { target: ["code"] };
    expect((service as any).isDepartmentCodeConflict(wrongCodeError)).toBe(
      false,
    );

    const wrongTargetError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    wrongTargetError.code = "P2002";
    wrongTargetError.meta = { target: ["name"] };
    expect((service as any).isDepartmentCodeConflict(wrongTargetError)).toBe(
      false,
    );

    const missingMetaError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    missingMetaError.code = "P2002";
    expect((service as any).isDepartmentCodeConflict(missingMetaError)).toBe(
      false,
    );

    const conflictError = Object.create(
      (Prisma as any).PrismaClientKnownRequestError.prototype,
    );
    conflictError.code = "P2002";
    conflictError.meta = { target: ["code"] };
    expect((service as any).isDepartmentCodeConflict(conflictError)).toBe(true);
  });

  it("should sort siblings by name when sortOrder is equal in getTree", async () => {
    prisma.department.findMany.mockResolvedValueOnce([
      {
        id: "r1",
        name: "部门乙",
        parentId: null,
        sortOrder: 1,
        manager: null,
        _count: { members: 0 },
      },
      {
        id: "r2",
        name: "部门甲",
        parentId: null,
        sortOrder: 1,
        manager: null,
        _count: { members: 0 },
      },
    ]);

    const result = await service.getTree();

    expect(result.map((item: any) => item.id)).toEqual(["r2", "r1"]);
  });

  it("should reject update when setting itself as parent", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      name: "研发部",
      parentId: null,
    } as any);

    await expect(
      service.update("d1", { parentId: "d1" } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject update when sibling department name already exists", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      name: "旧名称",
      parentId: "p1",
    } as any);
    prisma.department.findFirst.mockResolvedValueOnce({ id: "d2" });

    await expect(
      service.update("d1", {
        name: "新名称",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should reject update when parent is a child department", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      name: "研发部",
      parentId: null,
    } as any);
    prisma.department.findMany
      .mockResolvedValueOnce([{ id: "d2" }])
      .mockResolvedValueOnce([{ id: "d3" }])
      .mockResolvedValueOnce([]);

    await expect(
      service.update("d1", { parentId: "d3" } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should update department when parent relation is valid", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      name: "研发部",
      parentId: null,
    } as any);
    prisma.department.findMany
      .mockResolvedValueOnce([{ id: "d2" }])
      .mockResolvedValueOnce([]);
    prisma.department.update.mockResolvedValueOnce({
      id: "d1",
      parentId: "d3",
      name: "更新后",
    });

    await service.update("d1", {
      parentId: "d3",
      name: "更新后",
    } as any);

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { parentId: "d3", name: "更新后" },
    });
  });

  it("should reject remove when department has children", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      children: [{ id: "child1" }],
    } as any);

    await expect(service.remove("d1")).rejects.toThrow(BadRequestException);
  });

  it("should delete department when it has no children", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      children: [],
    } as any);
    prisma.department.delete.mockResolvedValueOnce({ id: "d1" });

    await service.remove("d1");

    expect(prisma.department.delete).toHaveBeenCalledWith({
      where: { id: "d1" },
    });
  });

  it("should toggle active status", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({
      id: "d1",
      isActive: true,
    } as any);
    prisma.department.update.mockResolvedValueOnce({
      id: "d1",
      isActive: false,
    });

    await service.toggleActive("d1");

    expect(prisma.department.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { isActive: false },
    });
  });

  it("should return members for department", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findMany.mockResolvedValueOnce([{ id: "u1", name: "Alice" }]);

    const result = await service.getMembers("d1");

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { departmentId: "d1" },
      }),
    );
    expect(result).toHaveLength(1);
  });

  it("should reject addMember when user does not exist", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.addMember("d1", "u1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should add member into department", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1" });
    prisma.user.update.mockResolvedValueOnce({ id: "u1", departmentId: "d1" });

    await service.addMember("d1", "u1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { departmentId: "d1" },
    });
  });

  it("should reject removeMember when user is not in department", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      departmentId: "d2",
    });

    await expect(service.removeMember("d1", "u1")).rejects.toThrow(
      BadRequestException,
    );
  });

  it("should remove member from department", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      departmentId: "d1",
    });
    prisma.user.update.mockResolvedValueOnce({ id: "u1", departmentId: null });

    await service.removeMember("d1", "u1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { departmentId: null },
    });
  });

  it("should reject setManager when user does not exist", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(service.setManager("d1", "u1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should auto-assign manager to department and set managerId", async () => {
    jest.spyOn(service, "findOne").mockResolvedValueOnce({ id: "d1" } as any);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      departmentId: "d2",
    });
    prisma.user.update.mockResolvedValueOnce({ id: "u1", departmentId: "d1" });
    prisma.department.update.mockResolvedValueOnce({
      id: "d1",
      managerId: "u1",
    });

    await service.setManager("d1", "u1");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { departmentId: "d1" },
    });
    expect(prisma.department.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d1" },
        data: { managerId: "u1" },
      }),
    );
  });

  it("should throw when findOneWithMembers does not exist", async () => {
    prisma.department.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOneWithMembers("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should return department details with members in findOneWithMembers", async () => {
    prisma.department.findUnique.mockResolvedValueOnce({
      id: "d1",
      name: "研发部",
      members: [{ id: "u1", name: "Alice" }],
      manager: null,
      children: [],
      _count: { members: 1 },
    });

    const result = await service.findOneWithMembers("d1");
    expect(result.id).toBe("d1");
    expect(result._count.members).toBe(1);
  });
});
