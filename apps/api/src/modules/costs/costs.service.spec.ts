import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CostsService } from './costs.service';

describe('CostsService', () => {
  let service: CostsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
      cost: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        groupBy: jest.fn(),
        aggregate: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
      contract: {
        findFirst: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (callback: any) => callback(prisma));

    service = new CostsService(prisma);
  });

  it('should fallback to createdAt when sortBy is invalid', async () => {
    await service.findAll({
      sortBy: 'invalidField',
      sortOrder: 'desc',
    } as any);

    const findManyArg = prisma.cost.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should respect allowed sortBy field', async () => {
    await service.findAll({
      sortBy: 'occurDate',
      sortOrder: 'asc',
    } as any);

    const findManyArg = prisma.cost.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ occurDate: 'asc' });
  });

  it('should use full-day range for date-only filters', async () => {
    await service.findAll({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    } as any);

    const where = prisma.cost.findMany.mock.calls[0][0].where;
    expect(where.occurDate.gte).toBeInstanceOf(Date);
    expect(where.occurDate.lte).toBeInstanceOf(Date);

    expect(where.occurDate.gte.getHours()).toBe(0);
    expect(where.occurDate.gte.getMinutes()).toBe(0);
    expect(where.occurDate.gte.getSeconds()).toBe(0);
    expect(where.occurDate.gte.getMilliseconds()).toBe(0);

    expect(where.occurDate.lte.getHours()).toBe(23);
    expect(where.occurDate.lte.getMinutes()).toBe(59);
    expect(where.occurDate.lte.getSeconds()).toBe(59);
    expect(where.occurDate.lte.getMilliseconds()).toBe(999);
  });

  it('should apply filters and pagination in findAll', async () => {
    prisma.cost.findMany.mockResolvedValueOnce([{ id: 'cost1' }]);
    prisma.cost.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      feeType: 'TRAVEL',
      source: 'DIRECT',
      projectId: 'p1',
      contractId: 'c1',
    } as any);

    expect(prisma.cost.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          feeType: 'TRAVEL',
          source: 'DIRECT',
          projectId: 'p1',
          contractId: 'c1',
        },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(1);
  });

  it('should throw when findOne cost does not exist', async () => {
    prisma.cost.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return cost details when findOne succeeds', async () => {
    prisma.cost.findUnique.mockResolvedValueOnce({
      id: 'cost-1',
      source: 'DIRECT',
      amount: 100,
    });

    const result = await service.findOne('cost-1');
    expect(result.id).toBe('cost-1');
  });

  it('should reject create when project does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({
        projectId: 'missing',
        feeType: 'TRAVEL',
        amount: 100,
        occurDate: '2026-03-01',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject create when contract does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({
        projectId: 'p1',
        contractId: 'missing-contract',
        feeType: 'TRAVEL',
        amount: 100,
        occurDate: '2026-03-01',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create direct cost when validations pass', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.contract.findFirst.mockResolvedValueOnce({ id: 'c1' });
    prisma.cost.create.mockResolvedValueOnce({ id: 'cost1' });

    await service.create({
      projectId: 'p1',
      contractId: 'c1',
      feeType: 'TRAVEL',
      amount: 100,
      occurDate: '2026-03-01',
      description: '直接录入费用',
    } as any);

    expect(prisma.cost.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: 'DIRECT',
          projectId: 'p1',
          contractId: 'c1',
          occurDate: expect.any(Date),
        }),
      }),
    );
  });

  it('should reject removing reimbursement cost', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'cost1',
      source: 'REIMBURSEMENT',
    } as any);

    await expect(service.remove('cost1')).rejects.toThrow(BadRequestException);
  });

  it('should remove direct cost', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'cost1',
      source: 'DIRECT',
    } as any);
    prisma.cost.delete.mockResolvedValueOnce({ id: 'cost1' });

    await service.remove('cost1');

    expect(prisma.cost.delete).toHaveBeenCalledWith({
      where: { id: 'cost1' },
    });
  });

  it('should return grouped contract cost summary', async () => {
    prisma.cost.groupBy.mockResolvedValueOnce([
      { feeType: 'TRAVEL', _sum: { amount: 100 } },
      { feeType: 'OFFICE', _sum: { amount: 50 } },
    ]);
    prisma.cost.aggregate.mockResolvedValueOnce({
      _sum: { amount: 150 },
    });

    const result = await service.getContractCostSummary('c1');

    expect(result).toEqual({
      byType: [
        { feeType: 'TRAVEL', amount: 100 },
        { feeType: 'OFFICE', amount: 50 },
      ],
      total: 150,
    });
  });

  it('should fallback contract cost summary total to zero when aggregate amount is null', async () => {
    prisma.cost.groupBy.mockResolvedValueOnce([{ feeType: 'TRAVEL', _sum: { amount: 100 } }]);
    prisma.cost.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });

    const result = await service.getContractCostSummary('c1');

    expect(result.total).toBe(0);
  });
});
