import { ConflictException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customer: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
        update: jest.fn(),
      },
      contract: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new CustomersService(prisma);
  });

  it('should fallback to createdAt sort when sortBy is invalid', async () => {
    await service.findAll({
      sortBy: 'invalidField',
      sortOrder: 'desc',
    } as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should build findAll filters with keyword and type', async () => {
    prisma.customer.findMany.mockResolvedValueOnce([{ id: 'c1' }]);
    prisma.customer.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 1,
      pageSize: 10,
      keyword: 'InfFinanceMs',
      type: 'ENTERPRISE',
      sortBy: 'name',
      sortOrder: 'asc',
    } as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          type: 'ENTERPRISE',
          OR: expect.any(Array),
        }),
        orderBy: { name: 'asc' },
      }),
    );
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should use findAll default paging and sort args', async () => {
    await service.findAll({} as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should throw not found when customer does not exist', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should reject create when credit code already exists', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      service.create(
        {
          name: '客户A',
          type: 'ENTERPRISE',
          creditCode: '91310000X',
        } as any,
        'u1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should generate incremental customer code and create pending approval customer', async () => {
    prisma.customer.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ code: 'CUS000009' });
    prisma.customer.create.mockResolvedValueOnce({ id: 'c1' });

    await service.create(
      {
        name: '客户B',
        type: 'ENTERPRISE',
        creditCode: '91310000Y',
      } as any,
      'submitter-1',
    );

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CUS000010',
          approvalStatus: ApprovalStatus.PENDING,
          submittedBy: 'submitter-1',
        }),
      }),
    );
  });

  it('should generate first customer code when no existing customer code found', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);
    prisma.customer.create.mockResolvedValueOnce({ id: 'c-first' });

    await service.create(
      {
        name: '首个客户',
        type: 'ENTERPRISE',
      } as any,
      'submitter-first',
    );

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'CUS000001',
          submittedBy: 'submitter-first',
        }),
      }),
    );
  });

  it('should retry create when customer code conflicts once', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['code'] };

    prisma.customer.create.mockRejectedValueOnce(conflictError).mockResolvedValueOnce({ id: 'c-retry' });

    await service.create(
      {
        name: '重试客户',
        type: 'ENTERPRISE',
      } as any,
      'u-retry',
    );

    expect(prisma.customer.create).toHaveBeenCalledTimes(2);
  });

  it('should throw business conflict when customer code conflicts in all retries', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['code'] };
    prisma.customer.create.mockRejectedValue(conflictError);

    await expect(
      service.create(
        {
          name: '重试失败客户',
          type: 'ENTERPRISE',
        } as any,
        'u-retry-fail',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should map creditCode unique conflict to business error in create', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['creditCode'] };
    prisma.customer.create.mockRejectedValueOnce(conflictError);

    await expect(
      service.create(
        {
          name: '信用代码冲突客户',
          type: 'ENTERPRISE',
          creditCode: '91310000ABC',
        } as any,
        'u-credit',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw original error when create fails with non-unique error', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    const originalError = new Error('db unavailable');
    prisma.customer.create.mockRejectedValueOnce(originalError);

    await expect(
      service.create(
        {
          name: '异常客户',
          type: 'ENTERPRISE',
        } as any,
        'u-err',
      ),
    ).rejects.toThrow('db unavailable');
  });

  it('should evaluate isUniqueConflict helper branches', () => {
    expect((service as any).isUniqueConflict(new Error('x'), 'code')).toBe(false);

    const nonConflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    nonConflictError.code = 'P2025';
    nonConflictError.meta = { target: ['code'] };
    expect((service as any).isUniqueConflict(nonConflictError, 'code')).toBe(false);

    const wrongTargetError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongTargetError.code = 'P2002';
    wrongTargetError.meta = { target: ['creditCode'] };
    expect((service as any).isUniqueConflict(wrongTargetError, 'code')).toBe(false);

    const missingMetaError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    missingMetaError.code = 'P2002';
    expect((service as any).isUniqueConflict(missingMetaError, 'code')).toBe(false);

    const codeConflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    codeConflictError.code = 'P2002';
    codeConflictError.meta = { target: ['code'] };
    expect((service as any).isUniqueConflict(codeConflictError, 'code')).toBe(true);
  });

  it('should reject update when new credit code duplicates another customer', async () => {
    prisma.customer.findFirst
      .mockResolvedValueOnce({
        id: 'c1',
        isDeleted: false,
        creditCode: 'OLD-CODE',
        contracts: [],
        _count: { contracts: 0 },
      })
      .mockResolvedValueOnce({ id: 'c2' });

    await expect(
      service.update('c1', {
        creditCode: 'NEW-CODE',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should update customer when creditCode is unchanged', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      isDeleted: false,
      creditCode: 'SAME-CODE',
      contracts: [],
      _count: { contracts: 0 },
    });
    prisma.customer.update.mockResolvedValueOnce({ id: 'c1', name: '新名称' });

    await service.update('c1', {
      name: '新名称',
      creditCode: 'SAME-CODE',
    } as any);

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: '新名称', creditCode: 'SAME-CODE' },
    });
  });

  it('should reject remove when related contracts exist', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      isDeleted: false,
      contracts: [],
      _count: { contracts: 2 },
    });
    prisma.contract.count.mockResolvedValueOnce(2);

    await expect(service.remove('c1')).rejects.toThrow(ConflictException);
  });

  it('should soft delete customer when no related contracts exist', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      isDeleted: false,
      contracts: [],
      _count: { contracts: 0 },
    });
    prisma.contract.count.mockResolvedValueOnce(0);
    prisma.customer.update.mockResolvedValueOnce({ id: 'c1', isDeleted: true });

    await service.remove('c1');

    expect(prisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isDeleted: true },
    });
  });

  it('should query approved options only', async () => {
    await service.getOptions();

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          isDeleted: false,
          approvalStatus: ApprovalStatus.APPROVED,
        },
      }),
    );
  });

  it('should throw when approving non-existing customer', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.approve(
        'missing',
        {
          approved: true,
          remark: 'ok',
        } as any,
        'approver-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject approving already approved customer', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      approvalStatus: ApprovalStatus.APPROVED,
      isDeleted: false,
    });

    await expect(
      service.approve(
        'c1',
        {
          approved: true,
        } as any,
        'approver-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('should set approval status and approver fields', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      approvalStatus: ApprovalStatus.PENDING,
      isDeleted: false,
    });
    prisma.customer.update.mockResolvedValueOnce({ id: 'c1', approvalStatus: ApprovalStatus.REJECTED });

    await service.approve(
      'c1',
      {
        approved: false,
        remark: '资料不完整',
      } as any,
      'approver-2',
    );

    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({
          approvalStatus: ApprovalStatus.REJECTED,
          approvedBy: 'approver-2',
          approvalRemark: '资料不完整',
        }),
      }),
    );
  });

  it('should set approval status to approved when approved flag is true', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      approvalStatus: ApprovalStatus.PENDING,
      isDeleted: false,
    });
    prisma.customer.update.mockResolvedValueOnce({ id: 'c1', approvalStatus: ApprovalStatus.APPROVED });

    await service.approve(
      'c1',
      {
        approved: true,
        remark: '通过',
      } as any,
      'approver-3',
    );

    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvalStatus: ApprovalStatus.APPROVED,
          approvedBy: 'approver-3',
        }),
      }),
    );
  });

  it('should query pending approval list with filters and safe sort', async () => {
    prisma.customer.findMany.mockResolvedValueOnce([
      {
        id: 'c1',
        name: '客户P',
        code: 'CUS000001',
        type: 'ENTERPRISE',
        approvalStatus: ApprovalStatus.PENDING,
        submittedBy: 'u1',
      },
    ]);
    prisma.customer.count.mockResolvedValueOnce(1);

    const result = await service.findPendingApproval({
      page: 1,
      pageSize: 20,
      keyword: '客户',
      type: 'ENTERPRISE',
      sortBy: 'invalid',
      sortOrder: 'desc',
    } as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          approvalStatus: ApprovalStatus.PENDING,
          type: 'ENTERPRISE',
        }),
        orderBy: { createdAt: 'desc' },
      }),
    );
    expect(result.items).toHaveLength(1);
  });

  it('should use findPendingApproval default args', async () => {
    await service.findPendingApproval({} as any);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        where: expect.objectContaining({
          approvalStatus: ApprovalStatus.PENDING,
        }),
      }),
    );
  });

  it('should return customer details when findOne succeeds', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({
      id: 'c1',
      code: 'CUS000001',
      name: '客户详情',
      isDeleted: false,
      _count: { contracts: 1 },
      contracts: [
        {
          id: 'ct1',
          amountWithTax: new Decimal(1000),
        },
      ],
    });

    const result = await service.findOne('c1');
    expect(result.id).toBe('c1');
    expect(result.code).toBe('CUS000001');
  });
});
