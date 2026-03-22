import { ConflictException, NotFoundException } from "@nestjs/common";
import { DictionariesService } from "./dictionaries.service";

describe("DictionariesService", () => {
  let service: DictionariesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      dictionary: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new DictionariesService(prisma);
  });

  it("should build query conditions in findAll", async () => {
    await service.findAll({
      type: "EXPENSE_TYPE",
      isEnabled: true,
    } as any);

    expect(prisma.dictionary.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "EXPENSE_TYPE", isEnabled: true },
      }),
    );
  });

  it("should throw when dictionary item is not found", async () => {
    prisma.dictionary.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  it("should return enabled dictionary options by type in findByType", async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([{ id: "d1", code: "A" }]);

    const result = await service.findByType("EXPENSE_TYPE");

    expect(prisma.dictionary.findMany).toHaveBeenCalledWith({
      where: {
        type: "EXPENSE_TYPE",
        isEnabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        value: true,
        color: true,
        isDefault: true,
      },
    });
    expect(result).toEqual([{ id: "d1", code: "A" }]);
  });

  it("should reuse cache for repeated findByType calls", async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([{ id: "d1", code: "A" }]);

    const result1 = await service.findByType("EXPENSE_TYPE");
    const result2 = await service.findByType("expense_type");

    expect(prisma.dictionary.findMany).toHaveBeenCalledTimes(1);
    expect(result1).toEqual([{ id: "d1", code: "A" }]);
    expect(result2).toEqual([{ id: "d1", code: "A" }]);
  });

  it("should throw conflict when creating duplicate dictionary code", async () => {
    prisma.dictionary.findUnique.mockResolvedValueOnce({ id: "d1" });

    await expect(
      service.create({
        type: "EXPENSE_TYPE",
        code: "TRAVEL",
        name: "差旅费",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should clear existing default item when creating a new default", async () => {
    prisma.dictionary.findUnique.mockResolvedValueOnce(null);
    prisma.dictionary.create.mockResolvedValueOnce({ id: "d2" });

    await service.create({
      type: "EXPENSE_TYPE",
      code: "ACCOMMODATION",
      name: "住宿费",
      isDefault: true,
    } as any);

    expect(prisma.dictionary.updateMany).toHaveBeenCalledWith({
      where: { type: "EXPENSE_TYPE", isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.dictionary.create).toHaveBeenCalled();
  });

  it("should invalidate by-type cache after create", async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([{ id: "d1", code: "A" }]);
    prisma.dictionary.findUnique.mockResolvedValueOnce(null);
    prisma.dictionary.create.mockResolvedValueOnce({
      id: "d2",
      type: "EXPENSE_TYPE",
      code: "B",
    });
    prisma.dictionary.findMany.mockResolvedValueOnce([{ id: "d2", code: "B" }]);

    await service.findByType("EXPENSE_TYPE");
    await service.create({
      type: "EXPENSE_TYPE",
      code: "B",
      name: "住宿费",
    } as any);
    const result = await service.findByType("EXPENSE_TYPE");

    expect(prisma.dictionary.findMany).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: "d2", code: "B" }]);
  });

  it("should throw conflict when updating to duplicated code", async () => {
    prisma.dictionary.findUnique
      .mockResolvedValueOnce({ id: "d1", type: "EXPENSE_TYPE", code: "TRAVEL" })
      .mockResolvedValueOnce({ id: "d2", type: "EXPENSE_TYPE", code: "HOTEL" });

    await expect(
      service.update("d1", {
        type: "EXPENSE_TYPE",
        code: "HOTEL",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should use existing type fallback when update dto does not provide type", async () => {
    prisma.dictionary.findUnique
      .mockResolvedValueOnce({ id: "d1", type: "EXPENSE_TYPE", code: "TRAVEL" })
      .mockResolvedValueOnce(null);
    prisma.dictionary.update.mockResolvedValueOnce({ id: "d1", code: "MEAL" });

    await service.update("d1", {
      code: "MEAL",
    } as any);

    expect(prisma.dictionary.findUnique).toHaveBeenNthCalledWith(2, {
      where: {
        type_code: {
          type: "EXPENSE_TYPE",
          code: "MEAL",
        },
      },
    });
  });

  it("should clear other defaults when setting current item as default in update", async () => {
    prisma.dictionary.findUnique.mockResolvedValueOnce({
      id: "d1",
      type: "EXPENSE_TYPE",
      code: "TRAVEL",
      isDefault: false,
    });
    prisma.dictionary.update.mockResolvedValueOnce({
      id: "d1",
      isDefault: true,
    });

    await service.update("d1", {
      isDefault: true,
    } as any);

    expect(prisma.dictionary.updateMany).toHaveBeenCalledWith({
      where: {
        type: "EXPENSE_TYPE",
        isDefault: true,
        NOT: { id: "d1" },
      },
      data: { isDefault: false },
    });
  });

  it("should ignore conflict errors in batchCreate", async () => {
    const createSpy = jest
      .spyOn(service, "create")
      .mockRejectedValueOnce(new ConflictException("duplicate"))
      .mockResolvedValueOnce({ id: "ok" } as any);

    const result = await service.batchCreate([
      { type: "EXPENSE_TYPE", code: "A", name: "A" } as any,
      { type: "EXPENSE_TYPE", code: "B", name: "B" } as any,
    ]);

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: "ok" }]);
  });

  it("should throw non-conflict errors in batchCreate", async () => {
    jest.spyOn(service, "create").mockRejectedValueOnce(new Error("db down"));

    await expect(
      service.batchCreate([
        { type: "EXPENSE_TYPE", code: "X", name: "X" } as any,
      ]),
    ).rejects.toThrow("db down");
  });

  it("should map getTypes result to string array", async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([
      { type: "CUSTOMER_TYPE" },
      { type: "EXPENSE_TYPE" },
    ]);

    const result = await service.getTypes();
    expect(result).toEqual(["CUSTOMER_TYPE", "EXPENSE_TYPE"]);
  });

  it("should remove dictionary item after existence check", async () => {
    prisma.dictionary.findUnique.mockResolvedValueOnce({ id: "d1" });
    prisma.dictionary.delete.mockResolvedValueOnce({ id: "d1" });

    await service.remove("d1");

    expect(prisma.dictionary.delete).toHaveBeenCalledWith({
      where: { id: "d1" },
    });
  });

  it("should initialize default customer types by delegating to batchCreate", async () => {
    const batchSpy = jest
      .spyOn(service, "batchCreate")
      .mockResolvedValueOnce([{ id: "c1" }] as any);

    const result = await service.initCustomerTypes();

    expect(batchSpy).toHaveBeenCalledWith([
      {
        type: "CUSTOMER_TYPE",
        code: "ENTERPRISE",
        name: "企业",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "CUSTOMER_TYPE",
        code: "INDIVIDUAL",
        name: "个人",
        color: "green",
        sortOrder: 2,
      },
    ]);
    expect(result).toEqual([{ id: "c1" }]);
  });

  it("should initialize default expense types by delegating to batchCreate", async () => {
    const batchSpy = jest
      .spyOn(service, "batchCreate")
      .mockResolvedValueOnce([{ id: "e1" }] as any);

    const result = await service.initExpenseTypes();

    expect(batchSpy).toHaveBeenCalledWith([
      {
        type: "EXPENSE_TYPE",
        code: "TRAVEL",
        name: "差旅费",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "EXPENSE_TYPE",
        code: "ACCOMMODATION",
        name: "住宿费",
        color: "cyan",
        sortOrder: 2,
      },
      {
        type: "EXPENSE_TYPE",
        code: "TRANSPORTATION",
        name: "交通费",
        color: "green",
        sortOrder: 3,
      },
      {
        type: "EXPENSE_TYPE",
        code: "ENTERTAINMENT",
        name: "招待费",
        color: "orange",
        sortOrder: 4,
      },
      {
        type: "EXPENSE_TYPE",
        code: "TEAM_BUILDING",
        name: "团建费",
        color: "purple",
        sortOrder: 5,
      },
      {
        type: "EXPENSE_TYPE",
        code: "COMMUNICATION",
        name: "通讯费",
        color: "geekblue",
        sortOrder: 6,
      },
      {
        type: "EXPENSE_TYPE",
        code: "OTHER",
        name: "其他",
        color: "default",
        sortOrder: 7,
      },
    ]);
    expect(result).toEqual([{ id: "e1" }]);
  });

  it("should initialize default contract types by delegating to batchCreate", async () => {
    const batchSpy = jest
      .spyOn(service, "batchCreate")
      .mockResolvedValueOnce([{ id: "ct1" }] as any);

    const result = await service.initContractTypes();

    expect(batchSpy).toHaveBeenCalledWith([
      {
        type: "CONTRACT_TYPE",
        code: "SALES",
        name: "销售合同",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "CONTRACT_TYPE",
        code: "PURCHASE",
        name: "采购合同",
        color: "cyan",
        sortOrder: 2,
      },
      {
        type: "CONTRACT_TYPE",
        code: "SERVICE",
        name: "服务合同",
        color: "green",
        sortOrder: 3,
      },
      {
        type: "CONTRACT_TYPE",
        code: "OTHER",
        name: "其他",
        color: "default",
        sortOrder: 4,
      },
    ]);
    expect(result).toEqual([{ id: "ct1" }]);
  });
});
