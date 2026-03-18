import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaymentRequestsService } from './payment-requests.service';

describe('PaymentRequestsService', () => {
  let service: PaymentRequestsService;
  let prisma: any;
  let notificationsService: any;

  beforeEach(() => {
    prisma = {
      paymentRequest: {
        findFirst: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'pr-1',
          isDeleted: false,
          status: 'DRAFT',
          remark: 'old',
        }),
        update: jest.fn().mockResolvedValue({ id: 'pr-1' }),
        aggregate: jest.fn(),
      },
      bankAccount: {
        findUnique: jest.fn().mockResolvedValue({ id: 'bank-1' }),
      },
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'proj-1', isDeleted: false }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    notificationsService = {
      createForUsers: jest.fn().mockResolvedValue({ count: 0 }),
      createNotification: jest.fn().mockResolvedValue({ id: 'n-1' }),
    };

    service = new PaymentRequestsService(prisma, notificationsService);
  });

  it('should use full-day range for date-only filters in findAll', async () => {
    await service.findAll({
      paymentDateStart: '2026-03-01',
      paymentDateEnd: '2026-03-31',
    } as any);

    const where = prisma.paymentRequest.findMany.mock.calls[0][0].where;
    expect(where.paymentDate.gte).toBeInstanceOf(Date);
    expect(where.paymentDate.lte).toBeInstanceOf(Date);
    expect(where.paymentDate.gte.getHours()).toBe(0);
    expect(where.paymentDate.gte.getMinutes()).toBe(0);
    expect(where.paymentDate.gte.getSeconds()).toBe(0);
    expect(where.paymentDate.gte.getMilliseconds()).toBe(0);
    expect(where.paymentDate.lte.getHours()).toBe(23);
    expect(where.paymentDate.lte.getMinutes()).toBe(59);
    expect(where.paymentDate.lte.getSeconds()).toBe(59);
    expect(where.paymentDate.lte.getMilliseconds()).toBe(999);
  });

  it('should include project relation in findOne query', async () => {
    await service.findOne('pr-1');

    expect(prisma.paymentRequest.findUnique).toHaveBeenCalledWith({
      where: { id: 'pr-1' },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true, phone: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  });

  it('should throw when findOne is missing or deleted', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);

    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-2',
      isDeleted: true,
    });
    await expect(service.findOne('pr-2')).rejects.toThrow(NotFoundException);
  });

  it('should reject create when project does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          projectId: 'missing',
          bankAccountId: 'bank-1',
          reason: '付款',
          amount: 100,
          paymentMethod: 'TRANSFER',
          paymentDate: '2026-03-01',
        } as any,
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject create when bank account does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    prisma.bankAccount.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.create(
        {
          projectId: 'proj-1',
          bankAccountId: 'missing-bank',
          reason: '付款',
          amount: 100,
          paymentMethod: 'TRANSFER',
          paymentDate: '2026-03-01',
        } as any,
        'u1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create payment request with generated requestNo', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: 'bank-1' });
    prisma.paymentRequest.findFirst.mockResolvedValueOnce({ requestNo: 'FK202603170009' });
    prisma.paymentRequest.create.mockResolvedValueOnce({ id: 'pr-1' });

    await service.create(
      {
        projectId: 'proj-1',
        bankAccountId: 'bank-1',
        reason: '付款',
        amount: 100,
        paymentMethod: 'TRANSFER',
        paymentDate: '2026-03-01',
        attachments: [{ name: 'a.pdf' }],
      } as any,
      'u1',
    );

    expect(prisma.paymentRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestNo: expect.stringMatching(/^FK\d{12}$/),
          status: 'DRAFT',
          project: { connect: { id: 'proj-1' } },
          bankAccount: { connect: { id: 'bank-1' } },
          applicant: { connect: { id: 'u1' } },
        }),
      }),
    );
  });

  it('should default currency to CNY when create dto does not provide currency', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ id: 'proj-1' });
    prisma.bankAccount.findUnique.mockResolvedValueOnce({ id: 'bank-1' });
    prisma.paymentRequest.findFirst.mockResolvedValueOnce(null);
    prisma.paymentRequest.create.mockResolvedValueOnce({ id: 'pr-2' });

    await service.create(
      {
        projectId: 'proj-1',
        bankAccountId: 'bank-1',
        reason: '默认币种测试',
        amount: 200,
        paymentMethod: 'TRANSFER',
        paymentDate: '2026-03-01',
      } as any,
      'u2',
    );

    const data = prisma.paymentRequest.create.mock.calls[0][0].data;
    expect(data.currency).toBe('CNY');
    expect(data.attachments).toBeUndefined();
  });

  it('should retry create when requestNo conflicts and then succeed', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', isDeleted: false });
    prisma.bankAccount.findUnique.mockResolvedValue({ id: 'bank-1' });
    prisma.paymentRequest.findFirst.mockResolvedValue({ requestNo: 'FK202603170009' });

    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['requestNo'] };

    prisma.paymentRequest.create
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({ id: 'pr-retry-ok' });

    await service.create(
      {
        projectId: 'proj-1',
        bankAccountId: 'bank-1',
        reason: '重试测试',
        amount: 300,
        paymentMethod: 'TRANSFER',
        paymentDate: '2026-03-02',
      } as any,
      'u3',
    );

    expect(prisma.paymentRequest.create).toHaveBeenCalledTimes(2);
  });

  it('should throw original conflict error on last retry', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj-1', isDeleted: false });
    prisma.bankAccount.findUnique.mockResolvedValue({ id: 'bank-1' });
    prisma.paymentRequest.findFirst.mockResolvedValue({ requestNo: 'FK202603170009' });

    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['requestNo'] };

    prisma.paymentRequest.create.mockRejectedValue(conflictError);

    await expect(
      service.create(
        {
          projectId: 'proj-1',
          bankAccountId: 'bank-1',
          reason: '重试失败测试',
          amount: 300,
          paymentMethod: 'TRANSFER',
          paymentDate: '2026-03-03',
        } as any,
        'u3',
      ),
    ).rejects.toBe(conflictError);
  });

  it('should evaluate isRequestNoConflict correctly', () => {
    const nonPrismaError = new Error('x');
    expect((service as any).isRequestNoConflict(nonPrismaError)).toBe(false);

    const wrongCodeError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongCodeError.code = 'P2025';
    wrongCodeError.meta = { target: ['requestNo'] };
    expect((service as any).isRequestNoConflict(wrongCodeError)).toBe(false);

    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['requestNo'] };
    expect((service as any).isRequestNoConflict(conflictError)).toBe(true);
  });

  it('should throw when updating with non-existing project', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(service.update('pr-1', { projectId: 'proj-missing' } as any)).rejects.toMatchObject({
      message: '关联项目不存在',
    });
  });

  it('should throw when updating with non-existing bank account', async () => {
    prisma.bankAccount.findUnique.mockResolvedValueOnce(null);

    await expect(service.update('pr-1', { bankAccountId: 'bank-missing' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject update when request is not draft', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
    });

    await expect(service.update('pr-1', { reason: 'x' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should connect project when projectId is provided in update', async () => {
    await service.update('pr-1', { projectId: 'proj-2' } as any);

    const updateArg = prisma.paymentRequest.update.mock.calls[0][0];
    expect(updateArg.data.project).toEqual({ connect: { id: 'proj-2' } });
  });

  it('should include paymentDate, bankAccount and attachments when update dto provides them', async () => {
    await service.update('pr-1', {
      paymentDate: '2026-03-08',
      bankAccountId: 'bank-2',
      attachments: [{ name: 'b.pdf' }],
    } as any);

    const updateArg = prisma.paymentRequest.update.mock.calls[0][0];
    expect(updateArg.data.paymentDate).toBeInstanceOf(Date);
    expect(updateArg.data.bankAccount).toEqual({ connect: { id: 'bank-2' } });
    expect(updateArg.data.attachments).toEqual([{ name: 'b.pdf' }]);
  });

  it('should reject submit when request is not draft', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
    });

    await expect(service.submit('pr-1')).rejects.toThrow(BadRequestException);
  });

  it('should submit draft request to pending', async () => {
    prisma.paymentRequest.update.mockResolvedValueOnce({ id: 'pr-1', status: 'PENDING' });
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'DRAFT',
      requestNo: 'FK202603170001',
      applicantId: 'u1',
    });
    prisma.user.findMany.mockResolvedValueOnce([{ id: 'manager-1' }]);

    await service.submit('pr-1');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pr-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          submitDate: expect.any(Date),
        }),
      }),
    );
    expect(notificationsService.createForUsers).toHaveBeenCalledWith(
      ['manager-1'],
      expect.objectContaining({
        type: 'APPROVAL',
        title: '新的付款申请待审批',
      }),
    );
  });

  it('should exclude applicant from approver notification list on submit', async () => {
    prisma.paymentRequest.update.mockResolvedValueOnce({ id: 'pr-1', status: 'PENDING' });
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'DRAFT',
      requestNo: 'FK202603170002',
      applicantId: 'manager-1',
    });
    prisma.user.findMany.mockResolvedValueOnce([{ id: 'manager-1' }, { id: 'admin-1' }]);

    await service.submit('pr-1');

    expect(notificationsService.createForUsers).toHaveBeenCalledWith(
      ['admin-1'],
      expect.objectContaining({
        type: 'APPROVAL',
      }),
    );
  });

  it('should reject approve when status is not pending', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'DRAFT',
    });

    await expect(
      service.approve('pr-1', { status: 'APPROVED' } as any, 'approver-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('should approve pending request', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
      requestNo: 'FK202603170001',
      applicantId: 'u1',
    });

    await service.approve(
      'pr-1',
      {
        status: 'APPROVED',
        approvalRemark: 'ok',
      } as any,
      'approver-1',
    );

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          approvedBy: 'approver-1',
          approvalRemark: 'ok',
        }),
      }),
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: 'APPROVAL',
      }),
    );
  });

  it('should send rejected notification to applicant when approve status is REJECTED', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
      requestNo: 'FK202603170010',
      applicantId: 'u9',
    });

    await service.approve(
      'pr-1',
      {
        status: 'REJECTED',
        approvalRemark: '资料不完整',
      } as any,
      'approver-1',
    );

    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u9',
        title: '付款申请已被驳回',
        type: 'APPROVAL',
      }),
    );
  });

  it('should skip applicant notification when applicantId is empty', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
      requestNo: 'FK202603170011',
      applicantId: '',
    });

    await service.approve(
      'pr-1',
      {
        status: 'APPROVED',
      } as any,
      'approver-1',
    );

    expect(notificationsService.createNotification).not.toHaveBeenCalled();
  });

  it('should reject confirmPayment when status is not approved', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
      remark: 'old',
    });

    await expect(service.confirmPayment('pr-1')).rejects.toThrow(BadRequestException);
  });

  it('should confirm payment and keep old remark when remark is not provided', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'APPROVED',
      remark: 'old',
      requestNo: 'FK202603170001',
      applicantId: 'u1',
    });

    await service.confirmPayment('pr-1');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'PAID',
          remark: 'old',
        },
      }),
    );
    expect(notificationsService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        type: 'PAYMENT',
      }),
    );
  });

  it('should confirm payment with explicit remark', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'APPROVED',
      remark: 'old',
    });

    await service.confirmPayment('pr-1', 'new-remark');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: 'PAID',
          remark: 'new-remark',
        },
      }),
    );
  });

  it('should reject cancel when status is not draft or pending', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PAID',
    });

    await expect(service.cancel('pr-1')).rejects.toThrow(BadRequestException);
  });

  it('should cancel request from pending status', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
    });

    await service.cancel('pr-1');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'pr-1' },
      data: {
        status: 'CANCELLED',
      },
    });
  });

  it('should reject remove when status is not draft', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'PENDING',
    });

    await expect(service.remove('pr-1')).rejects.toThrow(BadRequestException);
  });

  it('should soft delete request when status is draft', async () => {
    prisma.paymentRequest.findUnique.mockResolvedValueOnce({
      id: 'pr-1',
      isDeleted: false,
      status: 'DRAFT',
    });

    await service.remove('pr-1');

    expect(prisma.paymentRequest.update).toHaveBeenCalledWith({
      where: { id: 'pr-1' },
      data: { isDeleted: true },
    });
  });

  it('should return statistics with fallback sums', async () => {
    prisma.paymentRequest.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(3);
    prisma.paymentRequest.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1000 } })
      .mockResolvedValueOnce({ _sum: { amount: null } });

    const result = await service.getStatistics();

    expect(result).toEqual({
      totalCount: 10,
      draftCount: 1,
      pendingCount: 2,
      approvedCount: 3,
      rejectedCount: 1,
      paidCount: 3,
      totalAmount: 1000,
      paidAmount: 0,
    });
  });

  it('should fallback totalAmount to zero when aggregate returns null', async () => {
    prisma.paymentRequest.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    prisma.paymentRequest.aggregate
      .mockResolvedValueOnce({ _sum: { amount: null } })
      .mockResolvedValueOnce({ _sum: { amount: 500 } });

    const result = await service.getStatistics();
    expect(result.totalAmount).toBe(0);
    expect(result.paidAmount).toBe(500);
  });

  it('should build all optional filters in findAll', async () => {
    await service.findAll({
      requestNo: 'FK202603',
      reason: '采购',
      paymentMethod: 'TRANSFER',
      status: 'PENDING',
      projectId: 'proj-1',
      bankAccountId: 'bank-1',
      applicantId: 'u1',
      paymentDateStart: '2026-03-01',
      paymentDateEnd: '2026-03-10',
      page: 2,
      pageSize: 5,
    } as any);

    const where = prisma.paymentRequest.findMany.mock.calls[0][0].where;
    expect(where.requestNo).toEqual({ contains: 'FK202603' });
    expect(where.reason).toEqual({ contains: '采购' });
    expect(where.paymentMethod).toBe('TRANSFER');
    expect(where.status).toBe('PENDING');
    expect(where.projectId).toBe('proj-1');
    expect(where.bankAccountId).toBe('bank-1');
    expect(where.applicantId).toBe('u1');
    expect(where.paymentDate.gte).toBeInstanceOf(Date);
    expect(where.paymentDate.lte).toBeInstanceOf(Date);
  });

  it('should support paymentDateEnd-only filter in findAll', async () => {
    await service.findAll({
      paymentDateEnd: '2026-03-31',
    } as any);

    const where = prisma.paymentRequest.findMany.mock.calls[0][0].where;
    expect(where.paymentDate.gte).toBeUndefined();
    expect(where.paymentDate.lte).toBeInstanceOf(Date);
  });
});
