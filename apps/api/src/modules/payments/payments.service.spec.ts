import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  let service: PaymentsService;
  let prisma: any;
  let contractsService: any;

  beforeEach(() => {
    prisma = {
      contract: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      paymentPlan: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      paymentRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        aggregate: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    contractsService = {
      reconcileContractStatus: jest.fn().mockResolvedValue(undefined),
    };

    service = new PaymentsService(prisma, contractsService);
  });

  it("should calculate statistics summary and overdue amount", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        contractNo: "HT-001",
        name: "合同A",
        customer: { id: "u1", name: "客户A", code: "CUS000001" },
        amountWithTax: new Decimal(1000),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2025-01-01T00:00:00.000Z"),
            planAmount: new Decimal(400),
            paymentRecords: [{ amount: new Decimal(100) }],
          },
        ],
        paymentRecords: [{ amount: new Decimal(200) }],
        signDate: new Date("2025-01-01T00:00:00.000Z"),
        status: "EXECUTING",
      },
    ]);

    const result = await service.getStatistics();

    expect(result.summary.totalContractAmount.toNumber()).toBe(1000);
    expect(result.summary.totalPaidAmount.toNumber()).toBe(200);
    expect(result.summary.totalReceivable.toNumber()).toBe(800);
    expect(result.summary.overdueAmount.toNumber()).toBe(300);
    expect(result.summary.completionRate).toBe(20);
    expect(result.contracts[0].progress).toBe(20);
  });

  it("should set statistics progress and completionRate to zero when contract amount is zero", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c0",
        contractNo: "HT-000",
        name: "零金额合同",
        customer: { id: "u1", name: "客户A", code: "CUS000001" },
        amountWithTax: new Decimal(0),
        paymentPlans: [],
        paymentRecords: [],
        signDate: new Date("2025-01-01T00:00:00.000Z"),
        status: "EXECUTING",
      },
    ]);

    const result = await service.getStatistics();
    expect(result.contracts[0].progress).toBe(0);
    expect(result.summary.completionRate).toBe(0);
  });

  it("should compute paid and remaining amount in findPlansByContract", async () => {
    prisma.paymentPlan.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        period: 1,
        planAmount: new Decimal(500),
        paymentRecords: [
          { amount: new Decimal(120) },
          { amount: new Decimal(80) },
        ],
      },
    ]);

    const result = await service.findPlansByContract("c1");

    expect(result).toHaveLength(1);
    expect(result[0].paidAmount.toNumber()).toBe(200);
    expect(result[0].remainingAmount.toNumber()).toBe(300);
  });

  it("should query payment records by contract", async () => {
    await service.findRecordsByContract("c1");

    expect(prisma.paymentRecord.findMany).toHaveBeenCalledWith({
      where: { contractId: "c1" },
      orderBy: { paymentDate: "desc" },
      include: { plan: true },
    });
  });

  it("should throw when createPlan contract does not exist", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createPlan({
        contractId: "missing",
        period: 1,
        planAmount: new Decimal(100),
        planDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("should reject duplicate period in createPlan", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findFirst.mockResolvedValueOnce({ id: "p1" });

    await expect(
      service.createPlan({
        contractId: "c1",
        period: 1,
        planAmount: new Decimal(100),
        planDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject createPlan when total planned amount exceeds contract amount", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(500),
    });
    prisma.paymentPlan.findFirst.mockResolvedValueOnce(null);
    prisma.paymentPlan.aggregate.mockResolvedValueOnce({
      _sum: { planAmount: new Decimal(450) },
    });

    await expect(
      service.createPlan({
        contractId: "c1",
        period: 2,
        planAmount: new Decimal(100),
        planDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should create plan when validations pass", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findFirst.mockResolvedValueOnce(null);
    prisma.paymentPlan.aggregate.mockResolvedValueOnce({
      _sum: { planAmount: new Decimal(100) },
    });
    prisma.paymentPlan.create.mockResolvedValueOnce({ id: "p2" });

    await service.createPlan({
      contractId: "c1",
      period: 2,
      planAmount: new Decimal(300),
      planDate: "2026-02-01",
    } as any);

    expect(prisma.paymentPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: "c1",
          period: 2,
        }),
      }),
    );
  });

  it("should treat null existing plan amount as zero in createPlan", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findFirst.mockResolvedValueOnce(null);
    prisma.paymentPlan.aggregate.mockResolvedValueOnce({
      _sum: { planAmount: null },
    });
    prisma.paymentPlan.create.mockResolvedValueOnce({ id: "p3" });

    await service.createPlan({
      contractId: "c1",
      period: 1,
      planAmount: new Decimal(200),
      planDate: "2026-01-01",
    } as any);

    expect(prisma.paymentPlan.create).toHaveBeenCalled();
  });

  it("should throw when createPlans contract does not exist", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(service.createPlans("missing", [])).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should reject createPlans when total exceeds contract amount", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(300),
    });

    await expect(
      service.createPlans("c1", [
        {
          period: 1,
          planAmount: new Decimal(200),
          planDate: "2026-01-01",
        } as any,
        {
          period: 2,
          planAmount: new Decimal(200),
          planDate: "2026-02-01",
        } as any,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it("should replace plans in createPlans when validations pass", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      amountWithTax: new Decimal(800),
    });
    prisma.paymentPlan.deleteMany.mockResolvedValueOnce({ count: 2 });
    prisma.paymentPlan.createMany.mockResolvedValueOnce({ count: 2 });

    await service.createPlans("c1", [
      {
        period: 1,
        planAmount: new Decimal(300),
        planDate: "2026-01-01",
      } as any,
      {
        period: 2,
        planAmount: new Decimal(400),
        planDate: "2026-02-01",
      } as any,
    ]);

    expect(prisma.paymentPlan.deleteMany).toHaveBeenCalledWith({
      where: { contractId: "c1" },
    });
    expect(prisma.paymentPlan.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ contractId: "c1", period: 1 }),
        ]),
      }),
    );
  });

  it("should throw when createRecord contract does not exist", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createRecord({
        contractId: "missing",
        amount: new Decimal(100),
        paymentDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw when createRecord contract is not executing", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "DRAFT",
      amountWithTax: new Decimal(1000),
    });

    await expect(
      service.createRecord({
        contractId: "c1",
        amount: new Decimal(100),
        paymentDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw when createRecord plan does not exist", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createRecord({
        contractId: "c1",
        planId: "missing-plan",
        amount: new Decimal(100),
        paymentDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it("should throw when createRecord plan does not belong to contract", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      contractId: "c2",
    });

    await expect(
      service.createRecord({
        contractId: "c1",
        planId: "p1",
        amount: new Decimal(100),
        paymentDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should reject createRecord when new paid amount exceeds contract amount", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(300),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(250) },
    });

    await expect(
      service.createRecord({
        contractId: "c1",
        amount: new Decimal(100),
        paymentDate: "2026-01-01",
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it("should createRecord and refresh plan status to PARTIAL", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      contractId: "c1",
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(100) },
    });

    const tx = {
      paymentRecord: {
        create: jest.fn().mockResolvedValue({ id: "r1" }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Decimal(200) } }),
      },
      paymentPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "p1", planAmount: new Decimal(500) }),
        update: jest.fn().mockResolvedValue({ id: "p1", status: "PARTIAL" }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.createRecord({
      contractId: "c1",
      planId: "p1",
      amount: new Decimal(100),
      paymentDate: "2026-01-01",
      paymentMethod: "BANK_TRANSFER",
      remark: "test",
    } as any);

    expect(result.id).toBe("r1");
    expect(tx.paymentPlan.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "PARTIAL" },
    });
    expect(contractsService.reconcileContractStatus).toHaveBeenCalledWith("c1");
  });

  it("should createRecord with null paid aggregate fallback and no plan refresh", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });

    const tx = {
      paymentRecord: {
        create: jest.fn().mockResolvedValue({ id: "r-null" }),
      },
      paymentPlan: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.createRecord({
      contractId: "c1",
      amount: new Decimal(100),
      paymentDate: "2026-01-01",
      paymentMethod: "BANK_TRANSFER",
    } as any);

    expect(result.id).toBe("r-null");
    expect(tx.paymentPlan.update).not.toHaveBeenCalled();
  });

  it("should skip refreshPlanStatus update when plan is missing inside transaction", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      contractId: "c1",
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(0) },
    });

    const tx = {
      paymentRecord: {
        create: jest.fn().mockResolvedValue({ id: "r1" }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Decimal(100) } }),
      },
      paymentPlan: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.createRecord({
      contractId: "c1",
      planId: "p1",
      amount: new Decimal(100),
      paymentDate: "2026-01-01",
      paymentMethod: "BANK_TRANSFER",
    } as any);

    expect(tx.paymentPlan.update).not.toHaveBeenCalled();
  });

  it("should refresh plan to PENDING when aggregate amount is null", async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: "c1",
      status: "EXECUTING",
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      contractId: "c1",
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(0) },
    });

    const tx = {
      paymentRecord: {
        create: jest.fn().mockResolvedValue({ id: "r1" }),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      paymentPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "p1", planAmount: new Decimal(500) }),
        update: jest.fn().mockResolvedValue({ id: "p1", status: "PENDING" }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.createRecord({
      contractId: "c1",
      planId: "p1",
      amount: new Decimal(100),
      paymentDate: "2026-01-01",
      paymentMethod: "BANK_TRANSFER",
    } as any);

    expect(tx.paymentPlan.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "PENDING" },
    });
  });

  it("should reject removePlan when plan not found", async () => {
    prisma.paymentPlan.findUnique.mockResolvedValueOnce(null);

    await expect(service.removePlan("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should reject removePlan when plan already has records", async () => {
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      paymentRecords: [{ id: "r1" }],
    });

    await expect(service.removePlan("p1")).rejects.toThrow(BadRequestException);
  });

  it("should delete removePlan when plan has no records", async () => {
    prisma.paymentPlan.findUnique.mockResolvedValueOnce({
      id: "p1",
      paymentRecords: [],
    });
    prisma.paymentPlan.delete.mockResolvedValueOnce({ id: "p1" });

    await service.removePlan("p1");

    expect(prisma.paymentPlan.delete).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
  });

  it("should reject removeRecord when record not found", async () => {
    prisma.paymentRecord.findUnique.mockResolvedValueOnce(null);

    await expect(service.removeRecord("missing")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("should removeRecord with plan and reconcile contract", async () => {
    prisma.paymentRecord.findUnique.mockResolvedValueOnce({
      id: "r1",
      contractId: "c1",
      planId: "p1",
    });
    const tx = {
      paymentRecord: {
        delete: jest.fn().mockResolvedValue({ id: "r1" }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Decimal(500) } }),
      },
      paymentPlan: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: "p1", planAmount: new Decimal(500) }),
        update: jest.fn().mockResolvedValue({ id: "p1", status: "COMPLETED" }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.removeRecord("r1");

    expect(tx.paymentRecord.delete).toHaveBeenCalledWith({
      where: { id: "r1" },
    });
    expect(tx.paymentPlan.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { status: "COMPLETED" },
    });
    expect(contractsService.reconcileContractStatus).toHaveBeenCalledWith("c1");
    expect(result).toEqual({ message: "回款记录删除成功" });
  });
});
