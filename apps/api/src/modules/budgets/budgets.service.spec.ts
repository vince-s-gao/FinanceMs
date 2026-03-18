import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { BudgetsService } from './budgets.service';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      budget: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    service = new BudgetsService(prisma);
  });

  it('should filter budgets and calculate usage fields in findAll', async () => {
    prisma.budget.findMany.mockResolvedValueOnce([
      {
        id: 'b1',
        year: 2026,
        month: 3,
        department: 'FIN',
        feeType: 'TRAVEL',
        status: 'ACTIVE',
        budgetAmount: new Decimal(1000),
        usedAmount: new Decimal(200),
      },
    ]);
    prisma.budget.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      year: 2026,
      department: 'FIN',
      feeType: 'TRAVEL',
      status: 'ACTIVE',
    } as any);

    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          year: 2026,
          department: 'FIN',
          feeType: 'TRAVEL',
          status: 'ACTIVE',
        },
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0].usageRate).toBe(20);
    expect(result.items[0].remainingAmount).toBe(800);
    expect(result.items[0].isOverBudget).toBe(false);
  });

  it('should use default pagination in findAll when query is empty', async () => {
    await service.findAll({} as any);

    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
      }),
    );
  });

  it('should include month filter when month is provided', async () => {
    await service.findAll({
      year: 2026,
      month: 3,
    } as any);

    expect(prisma.budget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          year: 2026,
          month: 3,
        }),
      }),
    );
  });

  it('should set usageRate to zero when budget amount is zero in findAll', async () => {
    prisma.budget.findMany.mockResolvedValueOnce([
      {
        id: 'b-zero',
        year: 2026,
        month: 3,
        department: 'FIN',
        feeType: 'TRAVEL',
        status: 'ACTIVE',
        budgetAmount: new Decimal(0),
        usedAmount: new Decimal(100),
      },
    ]);
    prisma.budget.count.mockResolvedValueOnce(1);

    const result = await service.findAll({} as any);
    expect(result.items[0].usageRate).toBe(0);
    expect(result.items[0].isOverBudget).toBe(true);
  });

  it('should throw when budget is not found', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return usageRate as zero when budget amount is zero in findOne', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b2',
      status: 'ACTIVE',
      budgetAmount: new Decimal(0),
      usedAmount: new Decimal(10),
    });

    const result = await service.findOne('b2');
    expect(result.usageRate).toBe(0);
    expect(result.remainingAmount).toBe(-10);
  });

  it('should throw conflict when creating duplicated budget', async () => {
    prisma.budget.findFirst.mockResolvedValueOnce({ id: 'b1' });

    await expect(
      service.create({
        year: 2026,
        month: 3,
        department: 'FIN',
        feeType: 'TRAVEL',
        budgetAmount: 1000,
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should create yearly budget with month as null lookup key', async () => {
    prisma.budget.findFirst.mockResolvedValueOnce(null);
    prisma.budget.create.mockResolvedValueOnce({ id: 'b-yearly' });

    await service.create({
      year: 2026,
      department: 'FIN',
      feeType: 'TRAVEL',
      budgetAmount: 1200,
    } as any);

    expect(prisma.budget.findFirst).toHaveBeenCalledWith({
      where: {
        year: 2026,
        month: null,
        department: 'FIN',
        feeType: 'TRAVEL',
      },
    });
  });

  it('should reject update when budget is closed', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'CLOSED',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(0),
    });

    await expect(service.update('b1', { remark: 'x' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should update budget when status is not closed', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'ACTIVE',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(0),
    });
    prisma.budget.update.mockResolvedValueOnce({ id: 'b1', remark: 'ok' });

    await service.update('b1', { remark: 'ok' } as any);

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { remark: 'ok' },
    });
  });

  it('should reject remove when used amount is greater than zero', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'ACTIVE',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(1),
    });

    await expect(service.remove('b1')).rejects.toThrow(BadRequestException);
  });

  it('should remove budget when used amount is zero', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'ACTIVE',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(0),
    });
    prisma.budget.delete.mockResolvedValueOnce({ id: 'b1' });

    await service.remove('b1');

    expect(prisma.budget.delete).toHaveBeenCalledWith({
      where: { id: 'b1' },
    });
  });

  it('should toggle freeze from ACTIVE to FROZEN', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'ACTIVE',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(100),
    });
    prisma.budget.update.mockResolvedValueOnce({ id: 'b1', status: 'FROZEN' });

    await service.toggleFreeze('b1');

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'FROZEN' },
    });
  });

  it('should toggle freeze from FROZEN to ACTIVE', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'FROZEN',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(100),
    });
    prisma.budget.update.mockResolvedValueOnce({ id: 'b1', status: 'ACTIVE' });

    await service.toggleFreeze('b1');

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'ACTIVE' },
    });
  });

  it('should reject toggle freeze when budget already closed', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'CLOSED',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(100),
    });

    await expect(service.toggleFreeze('b1')).rejects.toThrow(BadRequestException);
  });

  it('should reject close when budget is already closed', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'CLOSED',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(100),
    });

    await expect(service.close('b1')).rejects.toThrow(BadRequestException);
  });

  it('should close budget when current status is not closed', async () => {
    prisma.budget.findUnique.mockResolvedValueOnce({
      id: 'b1',
      status: 'ACTIVE',
      budgetAmount: new Decimal(1000),
      usedAmount: new Decimal(100),
    });
    prisma.budget.update.mockResolvedValueOnce({ id: 'b1', status: 'CLOSED' });

    await service.close('b1');

    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { status: 'CLOSED' },
    });
  });

  it('should calculate department summary grouped by fee type', async () => {
    prisma.budget.findMany.mockResolvedValueOnce([
      {
        feeType: 'TRAVEL',
        budgetAmount: new Decimal(1000),
        usedAmount: new Decimal(500),
      },
      {
        feeType: 'TRAVEL',
        budgetAmount: new Decimal(500),
        usedAmount: new Decimal(100),
      },
      {
        feeType: 'OFFICE',
        budgetAmount: new Decimal(200),
        usedAmount: new Decimal(50),
      },
    ]);

    const result = await service.getDepartmentSummary(2026, 'FIN');

    expect(result.totalBudget).toBe(1700);
    expect(result.totalUsed).toBe(650);
    expect(result.totalRemaining).toBe(1050);
    expect(result.byFeeType.TRAVEL.budget).toBe(1500);
    expect(result.byFeeType.TRAVEL.used).toBe(600);
    expect(result.byFeeType.TRAVEL.rate).toBe(40);
  });

  it('should keep fee type rate and overall usageRate as zero when budget total is zero', async () => {
    prisma.budget.findMany.mockResolvedValueOnce([
      {
        feeType: 'OFFICE',
        budgetAmount: new Decimal(0),
        usedAmount: new Decimal(100),
      },
    ]);

    const result = await service.getDepartmentSummary(2026, 'FIN');
    expect(result.byFeeType.OFFICE.rate).toBe(0);
    expect(result.usageRate).toBe(0);
  });

  it('should map distinct departments to plain list', async () => {
    prisma.budget.findMany.mockResolvedValueOnce([{ department: 'FIN' }, { department: 'HR' }]);

    const result = await service.getDepartments();
    expect(result).toEqual(['FIN', 'HR']);
  });

  it('should update monthly budget used amount when monthly budget exists', async () => {
    prisma.budget.findFirst.mockResolvedValueOnce({ id: 'monthly-1' });
    prisma.budget.update.mockResolvedValueOnce({ id: 'monthly-1' });

    await service.updateUsedAmount('FIN', 'TRAVEL', 200, new Date('2026-03-05'));

    expect(prisma.budget.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ month: 3 }),
      }),
    );
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'monthly-1' },
      data: { usedAmount: { increment: 200 } },
    });
  });

  it('should fallback to yearly budget when monthly budget not found', async () => {
    prisma.budget.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'yearly-1' });
    prisma.budget.update.mockResolvedValueOnce({ id: 'yearly-1' });

    await service.updateUsedAmount('FIN', 'TRAVEL', 300, new Date('2026-03-20'));

    expect(prisma.budget.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.budget.update).toHaveBeenCalledWith({
      where: { id: 'yearly-1' },
      data: { usedAmount: { increment: 300 } },
    });
  });

  it('should skip update when no matching budget found', async () => {
    prisma.budget.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await service.updateUsedAmount('FIN', 'TRAVEL', 300, new Date('2026-03-20'));

    expect(prisma.budget.update).not.toHaveBeenCalled();
  });
});
