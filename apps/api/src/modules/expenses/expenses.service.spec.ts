import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      expense: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      expenseDetail: {
        deleteMany: jest.fn(),
      },
      project: {
        findFirst: jest.fn(),
      },
      contract: {
        findFirst: jest.fn(),
      },
      cost: {
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new ExpensesService(prisma, {} as any);
  });

  it('should fallback to createdAt when sortBy is invalid', async () => {
    await service.findAll(
      {
        sortBy: 'invalidField',
        sortOrder: 'desc',
      } as any,
      'user-1',
      'FINANCE',
    );

    const findManyArg = prisma.expense.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should respect allowed sortBy field', async () => {
    await service.findAll(
      {
        sortBy: 'paymentDate',
        sortOrder: 'asc',
      } as any,
      'user-1',
      'FINANCE',
    );

    const findManyArg = prisma.expense.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ paymentDate: 'asc' });
  });

  it('should use full-day range for date-only filters', async () => {
    await service.findAll(
      {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      } as any,
      'user-1',
      'FINANCE',
    );

    const where = prisma.expense.findMany.mock.calls[0][0].where;
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte).toBeInstanceOf(Date);

    expect(where.createdAt.gte.getHours()).toBe(0);
    expect(where.createdAt.gte.getMinutes()).toBe(0);
    expect(where.createdAt.gte.getSeconds()).toBe(0);
    expect(where.createdAt.gte.getMilliseconds()).toBe(0);

    expect(where.createdAt.lte.getHours()).toBe(23);
    expect(where.createdAt.lte.getMinutes()).toBe(59);
    expect(where.createdAt.lte.getSeconds()).toBe(59);
    expect(where.createdAt.lte.getMilliseconds()).toBe(999);
  });

  it('should limit EMPLOYEE to own expenses', async () => {
    await service.findAll({} as any, 'emp-1', 'EMPLOYEE');

    const where = prisma.expense.findMany.mock.calls[0][0].where;
    expect(where.applicantId).toBe('emp-1');
  });

  it('should build keyword and status filters in findAll', async () => {
    await service.findAll(
      {
        keyword: 'BX2026',
        status: 'PENDING',
      } as any,
      'user-1',
      'FINANCE',
    );

    const where = prisma.expense.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.status).toBe('PENDING');
  });

  it('should evaluate isExpenseNoConflict helper branches', () => {
    expect((service as any).isExpenseNoConflict(new Error('x'))).toBe(false);

    const wrongCodeError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongCodeError.code = 'P2025';
    wrongCodeError.meta = { target: ['expenseNo'] };
    expect((service as any).isExpenseNoConflict(wrongCodeError)).toBe(false);

    const wrongTargetError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongTargetError.code = 'P2002';
    wrongTargetError.meta = { target: ['otherField'] };
    expect((service as any).isExpenseNoConflict(wrongTargetError)).toBe(false);

    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['expenseNo'] };
    expect((service as any).isExpenseNoConflict(conflictError)).toBe(true);
  });

  it('should throw when findOne expense is missing', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce(null);

    await expect(service.findOne('missing', 'u1', 'EMPLOYEE')).rejects.toThrow(NotFoundException);
  });

  it('should forbid EMPLOYEE reading others expense', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      applicantId: 'u2',
    });

    await expect(service.findOne('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(ForbiddenException);
  });

  it('should reject create when related project does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          projectId: 'p1',
          reason: '出差',
          details: [{ amount: new Decimal(100), occurDate: '2026-03-01' }],
        } as any,
        'u1',
        'FIN',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject create when related contract does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          projectId: 'p1',
          contractId: 'c1',
          reason: '出差',
          details: [{ amount: new Decimal(100), occurDate: '2026-03-01' }],
        } as any,
        'u1',
        'FIN',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create expense with generated expenseNo and computed total', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'p1' });
    prisma.expense.findFirst.mockResolvedValueOnce({ expenseNo: 'BX202603-0010' });
    prisma.expense.create.mockResolvedValueOnce({ id: 'e1' });

    await service.create(
      {
        projectId: 'p1',
        reason: '出差',
        details: [
          { amount: new Decimal(100), occurDate: '2026-03-01', feeType: 'TRAVEL' },
          { amount: new Decimal(50), occurDate: '2026-03-02', feeType: 'TRAVEL' },
        ],
      } as any,
      'u1',
      'FIN',
    );

    expect(prisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expenseNo: expect.stringMatching(/^BX\d{6}-\d{4}$/),
          applicantId: 'u1',
          department: 'FIN',
          totalAmount: expect.anything(),
        }),
      }),
    );
    const callArg = prisma.expense.create.mock.calls[0][0];
    expect(callArg.data.totalAmount.toString()).toBe('150');
  });

  it('should retry create when generated expenseNo conflicts once', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.expense.findFirst.mockResolvedValue({ expenseNo: 'BX202603-0010' });
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['expenseNo'] };
    prisma.expense.create.mockRejectedValueOnce(conflictError).mockResolvedValueOnce({ id: 'e-retry' });

    await service.create(
      {
        projectId: 'p1',
        reason: '重试报销',
        details: [{ amount: new Decimal(50), occurDate: '2026-03-01', feeType: 'TRAVEL' }],
      } as any,
      'u1',
      'FIN',
    );

    expect(prisma.expense.create).toHaveBeenCalledTimes(2);
  });

  it('should reject update when expense status is not editable', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'PENDING',
      applicantId: 'u1',
    } as any);

    await expect(service.update('e1', { reason: 'x' } as any, 'u1', 'EMPLOYEE')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should update with details inside transaction', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u1',
      totalAmount: new Decimal(100),
    } as any);
    const tx = {
      expenseDetail: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      expense: {
        update: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.update(
      'e1',
      {
        reason: 'updated',
        details: [{ amount: new Decimal(80), occurDate: '2026-03-02', feeType: 'TRAVEL' }],
      } as any,
      'u1',
      'EMPLOYEE',
    );

    expect(tx.expenseDetail.deleteMany).toHaveBeenCalledWith({ where: { expenseId: 'e1' } });
    expect(tx.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({
          status: 'DRAFT',
          rejectReason: null,
        }),
      }),
    );
  });

  it('should forbid EMPLOYEE updating others expense', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u2',
      totalAmount: new Decimal(100),
    } as any);

    await expect(service.update('e1', { reason: 'x' } as any, 'u1', 'EMPLOYEE')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should update without replacing details when details is omitted', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u1',
      totalAmount: new Decimal(100),
    } as any);
    const tx = {
      expenseDetail: {
        deleteMany: jest.fn(),
      },
      expense: {
        update: jest.fn().mockResolvedValue({ id: 'e1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await service.update('e1', { reason: 'no-details-update' } as any, 'u1', 'EMPLOYEE');

    expect(tx.expenseDetail.deleteMany).not.toHaveBeenCalled();
    expect(tx.expense.update.mock.calls[0][0].data.details).toBeUndefined();
  });

  it('should reject submit when no details', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u1',
      details: [],
    } as any);

    await expect(service.submit('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(BadRequestException);
  });

  it('should reject submit when status is not editable', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'PAID',
      applicantId: 'u1',
      details: [{ id: 'd1' }],
    } as any);

    await expect(service.submit('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(BadRequestException);
  });

  it('should forbid EMPLOYEE submitting others expense', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u2',
      details: [{ id: 'd1' }],
    } as any);

    await expect(service.submit('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(ForbiddenException);
  });

  it('should submit draft expense', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u1',
      details: [{ id: 'd1' }],
    } as any);
    prisma.expense.update.mockResolvedValueOnce({ id: 'e1', status: 'PENDING' });

    await service.submit('e1', 'u1', 'EMPLOYEE');

    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'PENDING' }),
      }),
    );
  });

  it('should reject approve when expense not found', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce(null);

    await expect(service.approve('e1', { approved: true } as any)).rejects.toThrow(NotFoundException);
  });

  it('should reject approve when status is not pending', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({ id: 'e1', status: 'DRAFT' });

    await expect(service.approve('e1', { approved: true } as any)).rejects.toThrow(BadRequestException);
  });

  it('should reject approval rejection without reason', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({ id: 'e1', status: 'PENDING' });

    await expect(service.approve('e1', { approved: false } as any)).rejects.toThrow(BadRequestException);
  });

  it('should approve pending expense', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({ id: 'e1', status: 'PENDING' });
    prisma.expense.update.mockResolvedValueOnce({ id: 'e1', status: 'APPROVED' });

    await service.approve('e1', { approved: true } as any);

    expect(prisma.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'e1' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });

  it('should reject pay when expense status is not approved', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'PENDING',
      details: [],
    });

    await expect(service.pay('e1')).rejects.toThrow(BadRequestException);
  });

  it('should reject pay when expense does not exist', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce(null);
    await expect(service.pay('missing')).rejects.toThrow(NotFoundException);
  });

  it('should reject pay when already paid by concurrent update', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'APPROVED',
      details: [],
    });
    const tx = {
      expense: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ status: 'PAID' }),
      },
      cost: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(service.pay('e1')).rejects.toThrow(BadRequestException);
  });

  it('should reject pay when expense disappears after concurrent update check', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'APPROVED',
      details: [],
    });
    const tx = {
      expense: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      cost: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(service.pay('e1')).rejects.toThrow(NotFoundException);
  });

  it('should reject pay when generated costs already exist', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'APPROVED',
      projectId: 'p1',
      contractId: 'c1',
      details: [{ feeType: 'TRAVEL', amount: new Decimal(100), occurDate: new Date(), description: 'd' }],
    });
    const tx = {
      expense: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
      cost: {
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await expect(service.pay('e1')).rejects.toThrow(ConflictException);
  });

  it('should pay approved expense and create reimbursement costs', async () => {
    prisma.expense.findUnique.mockResolvedValueOnce({
      id: 'e1',
      status: 'APPROVED',
      projectId: 'p1',
      contractId: 'c1',
      details: [
        { feeType: 'TRAVEL', amount: new Decimal(100), occurDate: new Date('2026-03-01'), description: 'd1' },
        { feeType: 'ACCOMMODATION', amount: new Decimal(200), occurDate: new Date('2026-03-02'), description: 'd2' },
      ],
    });
    const tx = {
      expense: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ id: 'e1', status: 'PAID' }),
      },
      cost: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'cost1' }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const result = await service.pay('e1');

    expect(tx.cost.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ id: 'e1', status: 'PAID' });
  });

  it('should reject remove when expense is not draft', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'PENDING',
      applicantId: 'u1',
    } as any);

    await expect(service.remove('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(BadRequestException);
  });

  it('should remove draft expense', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u1',
    } as any);
    prisma.expense.delete.mockResolvedValueOnce({ id: 'e1' });

    await service.remove('e1', 'u1', 'EMPLOYEE');

    expect(prisma.expense.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });

  it('should forbid EMPLOYEE removing others draft expense', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'e1',
      status: 'DRAFT',
      applicantId: 'u2',
    } as any);

    await expect(service.remove('e1', 'u1', 'EMPLOYEE')).rejects.toThrow(ForbiddenException);
  });
});
