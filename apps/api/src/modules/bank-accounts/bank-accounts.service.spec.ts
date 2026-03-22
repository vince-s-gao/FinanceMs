import { BadRequestException, NotFoundException } from "@nestjs/common";
import { BankAccountsService } from "./bank-accounts.service";

describe("BankAccountsService", () => {
  let service: BankAccountsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      bankAccount: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        delete: jest.fn(),
      },
      paymentRequest: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new BankAccountsService(prisma);
  });

  it("should throw when creating duplicated account number", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });

    await expect(
      service.create({
        accountName: "Test",
        accountNo: "62220001",
        bankCode: "BOC",
        bankName: "Bank",
        region: "SH",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reset previous default account when creating new default account", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce(null);
    prisma.bankAccount.create.mockResolvedValueOnce({ id: "a2" });

    await service.create({
      accountName: "Default",
      accountNo: "62220002",
      bankCode: "CCB",
      bankName: "Bank",
      region: "SH",
      isDefault: true,
    } as any);

    expect(prisma.bankAccount.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.bankAccount.create).toHaveBeenCalled();
  });

  it("should apply default flags and optional defaults when creating non-default account", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce(null);
    prisma.bankAccount.create.mockResolvedValueOnce({ id: "a3" });

    await service.create({
      accountName: "Normal",
      accountNo: "62220003",
      bankCode: "ABC",
      bankName: "Bank",
      region: "SH",
    } as any);

    expect(prisma.bankAccount.updateMany).not.toHaveBeenCalled();
    expect(prisma.bankAccount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountType: "PERSONAL",
          currency: "CNY",
          isDefault: false,
        }),
      }),
    );
  });

  it("should filter enabled accounts by default", async () => {
    await service.findAll();
    expect(prisma.bankAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isEnabled: true },
      }),
    );
  });

  it("should throw when account not found", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne("missing")).rejects.toThrow(NotFoundException);
  });

  it("should reject duplicated account number during update", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });
    prisma.bankAccount.findFirst.mockResolvedValueOnce({ id: "a2" });

    await expect(
      service.update("a1", { accountNo: "dup" } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should clear other defaults when updating account as default", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });
    prisma.bankAccount.findFirst.mockResolvedValueOnce(null);
    prisma.bankAccount.update.mockResolvedValueOnce({
      id: "a1",
      isDefault: true,
    });

    await service.update("a1", {
      accountNo: "62220099",
      isDefault: true,
    } as any);

    expect(prisma.bankAccount.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true, id: { not: "a1" } },
      data: { isDefault: false },
    });
    expect(prisma.bankAccount.update).toHaveBeenCalled();
  });

  it("should toggle account enabled state", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({
      id: "a1",
      isEnabled: true,
    });
    prisma.bankAccount.update.mockResolvedValueOnce({
      id: "a1",
      isEnabled: false,
    });

    await service.toggleEnabled("a1");

    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { isEnabled: false },
    });
  });

  it("should reject removal when related payment requests exist", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });
    prisma.paymentRequest.count.mockResolvedValueOnce(2);

    await expect(service.remove("a1")).rejects.toThrow(BadRequestException);
  });

  it("should remove account when no related payment request exists", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });
    prisma.paymentRequest.count.mockResolvedValueOnce(0);
    prisma.bankAccount.delete.mockResolvedValueOnce({ id: "a1" });

    await service.remove("a1");

    expect(prisma.bankAccount.delete).toHaveBeenCalledWith({
      where: { id: "a1" },
    });
  });

  it("should clear previous default and set current account as default", async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: "a1" });
    prisma.bankAccount.update.mockResolvedValueOnce({
      id: "a1",
      isDefault: true,
    });

    await service.setDefault("a1");

    expect(prisma.bankAccount.updateMany).toHaveBeenCalledWith({
      where: { isDefault: true },
      data: { isDefault: false },
    });
    expect(prisma.bankAccount.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { isDefault: true },
    });
  });
});
