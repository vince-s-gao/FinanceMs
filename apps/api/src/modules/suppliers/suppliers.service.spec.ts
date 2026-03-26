import { ConflictException, NotFoundException } from "@nestjs/common";
import { SuppliersService } from "./suppliers.service";
import { encryptNullable } from "../../common/utils/encryption.utils";

describe("SuppliersService", () => {
  let service: SuppliersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      supplier: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      contract: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      dictionary: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new SuppliersService(prisma);
  });

  it("should fallback to createdAt sort when sortBy is invalid", async () => {
    await service.findAll({
      sortBy: "not_allowed",
      sortOrder: "desc",
    } as any);

    expect(prisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("should throw not found when supplier does not exist", async () => {
    prisma.supplier.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  it("should reject create when credit code already exists", async () => {
    prisma.supplier.findFirst.mockResolvedValueOnce({ id: "s1" });

    await expect(
      service.create({
        name: "供应商A",
        type: "CORPORATE",
        creditCode: "91310000X",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should generate supplier code and encrypt sensitive fields on create", async () => {
    prisma.supplier.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: "SUP000009" });
    prisma.supplier.create.mockResolvedValueOnce({
      id: "s-new",
      code: "SUP000010",
      name: "供应商B",
      type: "CORPORATE",
      creditCode: encryptNullable("91310000Y"),
      bankAccountNo: encryptNullable("62220001"),
      isDeleted: false,
    });

    const result = await service.create({
      name: "供应商B",
      type: "CORPORATE",
      creditCode: "91310000Y",
      bankAccountNo: "62220001",
    } as any);

    expect(prisma.supplier.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: "SUP000010",
          creditCode: expect.stringMatching(/^enc:v1:/),
          bankAccountNo: expect.stringMatching(/^enc:v1:/),
        }),
      }),
    );
    expect(result.creditCode).toBe("91310000Y");
    expect(result.bankAccountNo).toBe("62220001");
  });

  it("should reject update when new credit code duplicates another supplier", async () => {
    prisma.supplier.findFirst
      .mockResolvedValueOnce({
        id: "s1",
        isDeleted: false,
        creditCode: encryptNullable("OLD-CODE"),
      })
      .mockResolvedValueOnce({ id: "s2" });

    await expect(
      service.update("s1", {
        creditCode: "NEW-CODE",
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it("should compute contractCount and exclude sales contracts", async () => {
    prisma.supplier.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        code: "SUP000001",
        name: "供应商甲",
        type: "CORPORATE",
        isDeleted: false,
      },
      {
        id: "s2",
        code: "SUP000002",
        name: "供应商乙",
        type: "CORPORATE",
        isDeleted: false,
      },
    ]);
    prisma.supplier.count.mockResolvedValueOnce(2);
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        contractType: "SALES",
        customer: { name: "供应商甲" },
      },
      {
        contractType: "PURCHASE",
        customer: { name: "供应商甲" },
      },
      {
        contractType: "PURCHASE",
        customer: { name: "供应商乙" },
      },
    ]);
    prisma.dictionary.findMany.mockResolvedValueOnce([
      { code: "SALES", name: "销售合同", value: "销售" },
      { code: "PURCHASE", name: "采购合同", value: "采购" },
    ]);

    const result = await service.findAll({
      page: 1,
      pageSize: 20,
    } as any);

    expect(
      result.items.find((item: any) => item.id === "s1")?.contractCount,
    ).toBe(1);
    expect(
      result.items.find((item: any) => item.id === "s2")?.contractCount,
    ).toBe(1);
  });
});
