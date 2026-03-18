import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  let service: ContractsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      contract: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentRecord: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      dictionary: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      contractImportLog: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    service = new ContractsService(prisma);
  });

  it('should fallback to createdAt when sortBy is invalid', async () => {
    await service.findAll({
      sortBy: 'invalidField' as any,
      sortOrder: 'desc',
    } as any);

    const findManyArg = prisma.contract.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should respect allowed sortBy field', async () => {
    await service.findAll({
      sortBy: 'signDate',
      sortOrder: 'asc',
    } as any);

    const findManyArg = prisma.contract.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ signDate: 'asc' });
  });

  it('should use full-day range for date-only filters', async () => {
    await service.findAll({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    } as any);

    const where = prisma.contract.findMany.mock.calls[0][0].where;
    expect(where.signDate.gte).toBeInstanceOf(Date);
    expect(where.signDate.lte).toBeInstanceOf(Date);

    expect(where.signDate.gte.getHours()).toBe(0);
    expect(where.signDate.gte.getMinutes()).toBe(0);
    expect(where.signDate.gte.getSeconds()).toBe(0);
    expect(where.signDate.gte.getMilliseconds()).toBe(0);

    expect(where.signDate.lte.getHours()).toBe(23);
    expect(where.signDate.lte.getMinutes()).toBe(59);
    expect(where.signDate.lte.getSeconds()).toBe(59);
    expect(where.signDate.lte.getMilliseconds()).toBe(999);
  });

  it('should build all optional filters in findAll', async () => {
    await service.findAll({
      keyword: '测试',
      customerKeyword: '客户A',
      signYear: 2026,
      contractType: 'SERVICE',
      status: 'DRAFT',
      customerId: 'cus-1',
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      page: 2,
      pageSize: 5,
    } as any);

    const callArg = prisma.contract.findMany.mock.calls[0][0];
    expect(callArg.where.OR).toBeDefined();
    expect(callArg.where.customer).toEqual({
      name: { contains: '客户A', mode: 'insensitive' },
    });
    expect(callArg.where.contractType).toBe('SERVICE');
    expect(callArg.where.status).toBe('DRAFT');
    expect(callArg.where.customerId).toBe('cus-1');
    expect(callArg.where.signDate.gte).toBeInstanceOf(Date);
    expect(callArg.where.signDate.lte).toBeInstanceOf(Date);
    expect(callArg.skip).toBe(5);
    expect(callArg.take).toBe(5);
  });

  it('should aggregate payment and return receivable correctly', async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: 'c1',
        amountWithTax: new Decimal(1000),
        customer: { id: 'u1', name: '客户A', code: 'CUS000001' },
        _count: { paymentRecords: 1, invoices: 0 },
      },
    ]);
    prisma.contract.count.mockResolvedValueOnce(1);
    prisma.paymentRecord.groupBy.mockResolvedValueOnce([
      {
        contractId: 'c1',
        _sum: { amount: new Decimal(400) },
      },
    ]);

    const result = await service.findAll({} as any);

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].totalPaid.toString()).toBe('400');
    expect(result.items[0].receivable.toString()).toBe('600');
  });

  it('should fallback grouped null payment amount to zero in findAll', async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: 'c-null',
        amountWithTax: new Decimal(100),
        customer: { id: 'u1', name: '客户A', code: 'CUS000001' },
        _count: { paymentRecords: 0, invoices: 0 },
      },
    ]);
    prisma.contract.count.mockResolvedValueOnce(1);
    prisma.paymentRecord.groupBy.mockResolvedValueOnce([
      {
        contractId: 'c-null',
        _sum: { amount: null },
      },
    ]);

    const result = await service.findAll({} as any);

    expect(result.items[0].totalPaid.toString()).toBe('0');
    expect(result.items[0].receivable.toString()).toBe('100');
  });

  it('should fallback missing grouped payment row to zero in findAll', async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: 'c-miss',
        amountWithTax: new Decimal(300),
        customer: { id: 'u1', name: '客户A', code: 'CUS000001' },
        _count: { paymentRecords: 0, invoices: 0 },
      },
    ]);
    prisma.contract.count.mockResolvedValueOnce(1);
    prisma.paymentRecord.groupBy.mockResolvedValueOnce([]);

    const result = await service.findAll({} as any);

    expect(result.items[0].totalPaid.toString()).toBe('0');
    expect(result.items[0].receivable.toString()).toBe('300');
  });

  it('should throw when findOne contract does not exist', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should calculate summary in findOne', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: 'c1',
      amountWithTax: new Decimal(1000),
      paymentRecords: [{ amount: new Decimal(200) }, { amount: new Decimal(300) }],
      invoices: [
        { status: 'ISSUED', amount: new Decimal(100) },
        { status: 'VOIDED', amount: new Decimal(20) },
      ],
    });

    const result = await service.findOne('c1');

    expect(result.summary.totalPaid.toString()).toBe('500');
    expect(result.summary.receivable.toString()).toBe('500');
    expect(result.summary.totalInvoiced.toString()).toBe('100');
    expect(result.summary.uninvoiced.toString()).toBe('400');
    expect(result.summary.paymentProgress).toBe('50.00');
  });

  it('should reject create when customer does not exist', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({
        customerId: 'missing',
        signDate: '2026-03-01',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create contract with generated contractNo', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ id: 'cus1' });
    prisma.contract.findFirst.mockResolvedValueOnce({ contractNo: 'HT202603-0009' });
    prisma.contract.create.mockResolvedValueOnce({ id: 'c1' });

    await service.create({
      customerId: 'cus1',
      name: '测试合同',
      amountWithTax: new Decimal(1000),
      signDate: '2026-03-01',
      startDate: '2026-03-02',
      endDate: '2026-12-31',
    } as any);

    expect(prisma.contract.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractNo: 'HT202603-0010',
          customerId: 'cus1',
        }),
      }),
    );
  });

  it('should create contract with null optional dates when not provided', async () => {
    prisma.customer.findFirst.mockResolvedValueOnce({ id: 'cus1' });
    prisma.contract.findFirst.mockResolvedValueOnce({ contractNo: 'HT202603-0009' });
    prisma.contract.create.mockResolvedValueOnce({ id: 'c2' });

    await service.create({
      customerId: 'cus1',
      name: '无可选日期合同',
      amountWithTax: new Decimal(1000),
      signDate: '2026-03-01',
    } as any);

    const data = prisma.contract.create.mock.calls[0][0].data;
    expect(data.startDate).toBeNull();
    expect(data.endDate).toBeNull();
  });

  it('should retry create when contractNo conflicts once', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cus1' });
    prisma.contract.findFirst.mockResolvedValue({ contractNo: 'HT202603-0009' });
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['contractNo'] };
    prisma.contract.create.mockRejectedValueOnce(conflictError).mockResolvedValueOnce({ id: 'c-retry' });

    await service.create({
      customerId: 'cus1',
      name: '重试合同',
      amountWithTax: new Decimal(100),
      signDate: '2026-03-01',
    } as any);

    expect(prisma.contract.create).toHaveBeenCalledTimes(2);
  });

  it('should throw business conflict when contractNo conflicts in all retries', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cus1' });
    prisma.contract.findFirst.mockResolvedValue({ contractNo: 'HT202603-0009' });
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['contractNo'] };
    prisma.contract.create.mockRejectedValue(conflictError);

    await expect(
      service.create({
        customerId: 'cus1',
        name: '重试失败合同',
        amountWithTax: new Decimal(100),
        signDate: '2026-03-01',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw original error when create fails with non-contractNo conflict', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cus1' });
    prisma.contract.findFirst.mockResolvedValue({ contractNo: 'HT202603-0009' });
    const originalError = new Error('db unavailable');
    prisma.contract.create.mockRejectedValueOnce(originalError);

    await expect(
      service.create({
        customerId: 'cus1',
        name: '异常合同',
        amountWithTax: new Decimal(100),
        signDate: '2026-03-01',
      } as any),
    ).rejects.toThrow('db unavailable');
  });

  it('should evaluate isContractNoConflict helper branches', () => {
    expect((service as any).isContractNoConflict(new Error('x'))).toBe(false);

    const wrongCodeError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongCodeError.code = 'P2025';
    wrongCodeError.meta = { target: ['contractNo'] };
    expect((service as any).isContractNoConflict(wrongCodeError)).toBe(false);

    const wrongTargetError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongTargetError.code = 'P2002';
    wrongTargetError.meta = { target: ['name'] };
    expect((service as any).isContractNoConflict(wrongTargetError)).toBe(false);

    const missingMetaError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    missingMetaError.code = 'P2002';
    expect((service as any).isContractNoConflict(missingMetaError)).toBe(false);

    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['contractNo'] };
    expect((service as any).isContractNoConflict(conflictError)).toBe(true);
  });

  it('should reject update when contract is not draft', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'EXECUTING',
    } as any);

    await expect(service.update('c1', { name: 'x' } as any)).rejects.toThrow(BadRequestException);
  });

  it('should update draft contract with normalized dates', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'DRAFT',
    } as any);
    prisma.contract.update.mockResolvedValueOnce({ id: 'c1' });

    await service.update('c1', {
      name: 'updated',
      signDate: '2026-03-01',
      startDate: '2026-03-02',
      endDate: '2026-12-31',
    } as any);

    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: expect.objectContaining({
          name: 'updated',
          signDate: expect.any(Date),
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      }),
    );
  });

  it('should keep dates undefined when update dto omits date fields', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'DRAFT',
    } as any);
    prisma.contract.update.mockResolvedValueOnce({ id: 'c1' });

    await service.update('c1', {
      name: 'only-name',
    } as any);

    const data = prisma.contract.update.mock.calls[0][0].data;
    expect(data.signDate).toBeUndefined();
    expect(data.startDate).toBeUndefined();
    expect(data.endDate).toBeUndefined();
  });

  it('should reject invalid status transition', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'DRAFT',
    } as any);

    await expect(service.changeStatus('c1', { status: 'COMPLETED' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should change status with valid transition', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'DRAFT',
    } as any);
    prisma.contract.update.mockResolvedValueOnce({ id: 'c1', status: 'EXECUTING' });

    await service.changeStatus('c1', { status: 'EXECUTING' } as any);

    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'EXECUTING' },
    });
  });

  it('should reject remove when contract is not draft', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'EXECUTING',
    } as any);

    await expect(service.remove('c1')).rejects.toThrow(BadRequestException);
  });

  it('should soft delete draft contract', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'c1',
      status: 'DRAFT',
    } as any);
    prisma.contract.update.mockResolvedValueOnce({ id: 'c1', isDeleted: true });

    await service.remove('c1');

    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { isDeleted: true },
    });
  });

  it('should skip reconcile when contract is missing', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce(null);

    await service.reconcileContractStatus('c1');

    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('should skip reconcile when contract status is not EXECUTING/COMPLETED', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'TERMINATED',
      amountWithTax: new Decimal(1000),
    });

    await service.reconcileContractStatus('c1');

    expect(prisma.paymentRecord.aggregate).not.toHaveBeenCalled();
    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('should set status to COMPLETED when paid amount reaches contract amount', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'EXECUTING',
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(1000) },
    });

    await service.reconcileContractStatus('c1');

    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'COMPLETED' },
    });
  });

  it('should set status to EXECUTING when completed contract is underpaid', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'COMPLETED',
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(200) },
    });

    await service.reconcileContractStatus('c1');

    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'EXECUTING' },
    });
  });

  it('should skip update when reconcile status result is unchanged', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'EXECUTING',
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(500) },
    });

    await service.reconcileContractStatus('c1');

    expect(prisma.contract.update).not.toHaveBeenCalled();
  });

  it('should treat null aggregate amount as zero in reconcileContractStatus', async () => {
    prisma.contract.findUnique.mockResolvedValueOnce({
      id: 'c1',
      status: 'COMPLETED',
      amountWithTax: new Decimal(1000),
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });

    await service.reconcileContractStatus('c1');

    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'EXECUTING' },
    });
  });

  it('should proxy checkAndCompleteContract to reconcileContractStatus', async () => {
    const reconcileSpy = jest
      .spyOn(service, 'reconcileContractStatus')
      .mockResolvedValueOnce(undefined);

    await service.checkAndCompleteContract('c1');

    expect(reconcileSpy).toHaveBeenCalledWith('c1');
  });

  it('should export contracts csv with required headers', async () => {
    jest.spyOn(service, 'findAll').mockResolvedValueOnce({
      items: [
        {
          contractNo: 'HT202603-0001',
          signDate: new Date('2026-03-18'),
          name: '测试合同',
          customer: { name: '测试客户' },
          signingEntity: 'InfFinanceMs',
          contractType: 'SERVICE',
          amountWithTax: new Decimal(1000),
          endDate: new Date('2026-12-31'),
          status: 'EXECUTING',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10000,
      totalPages: 1,
    } as any);

    const csv = await service.exportCsv({ keyword: '测试' } as any);

    expect(csv).toContain('合同编号');
    expect(csv).toContain('签约年份');
    expect(csv).toContain('测试合同');
    expect(csv).toContain('InfFinanceMs');
    expect(csv).toContain('执行中');
  });

  it('should import contracts from csv and return summary', async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([
      { code: 'SERVICE', name: '服务合同' },
    ]);
    prisma.customer.findMany.mockResolvedValueOnce([
      { id: 'cus-1', name: '测试客户' },
    ]);
    jest.spyOn(service, 'create').mockResolvedValue({ id: 'c-import' } as any);

    const csv = Buffer.from(
      [
        '合同名称,客户名称,公司签约主体,合同类型,合同金额,签署日期,结束日期',
        '导入合同A,测试客户,InfFinanceMs,服务合同,1000,2026-03-18,2026-12-31',
      ].join('\n'),
      'utf-8',
    );

    const result = await service.importCsv(csv);

    expect(result).toEqual({
      total: 1,
      success: 1,
      failed: 0,
      errors: [],
    });
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(prisma.contractImportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'contracts-import.csv',
          total: 1,
          success: 1,
          failed: 0,
          allowPartial: false,
        }),
      }),
    );
  });

  it('should preview import csv before commit', async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([
      { code: 'SERVICE', name: '服务合同' },
    ]);
    prisma.customer.findMany.mockResolvedValueOnce([
      { id: 'cus-1', name: '测试客户' },
    ]);

    const csv = Buffer.from(
      [
        '合同名称,客户名称,公司签约主体,合同类型,合同金额,签署日期,结束日期',
        '导入合同A,测试客户,InfFinanceMs,服务合同,1000,2026-03-18,2026-12-31',
      ].join('\n'),
      'utf-8',
    );

    const result = await service.previewImportCsv(csv);

    expect(result).toEqual({
      total: 1,
      valid: 1,
      invalid: 0,
      errors: [],
      samples: [
        {
          row: 2,
          name: '导入合同A',
          customerName: '测试客户',
          contractType: '服务合同',
          amount: 1000,
          signDate: '2026-03-18',
        },
      ],
    });
  });

  it('should support english alias headers when importing csv', async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([{ code: 'SERVICE', name: '服务合同' }]);
    prisma.customer.findMany.mockResolvedValueOnce([{ id: 'cus-1', name: '测试客户' }]);
    jest.spyOn(service, 'create').mockResolvedValue({ id: 'c-import-2' } as any);

    const csv = Buffer.from(
      [
        'name,customer_name,signing_entity,contract_type,amount,sign_date,end_date',
        'Alias合同,测试客户,InfFinanceMs,SERVICE,8888,2026-04-01,2026-12-31',
      ].join('\n'),
      'utf-8',
    );

    const result = await service.importCsv(csv);

    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Alias合同',
        contractType: 'SERVICE',
        amountWithTax: 8888,
        signDate: '2026-04-01',
      }),
    );
  });

  it('should record row errors when import data is invalid', async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([
      { code: 'SERVICE', name: '服务合同' },
    ]);
    prisma.customer.findMany.mockResolvedValueOnce([
      { id: 'cus-1', name: '测试客户' },
    ]);

    const csv = Buffer.from(
      [
        '合同名称,客户名称,公司签约主体,合同类型,合同金额,签署日期,结束日期',
        ',测试客户,InfFinanceMs,服务合同,1000,2026-03-18,2026-12-31',
        '导入合同B,未知客户,InfFinanceMs,服务合同,1000,2026-03-18,',
        '导入合同C,测试客户,InfFinanceMs,未知类型,1000,2026-03-18,',
      ].join('\n'),
      'utf-8',
    );

    await expect(service.importCsv(csv)).rejects.toThrow(BadRequestException);
    expect(prisma.contractImportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fileName: 'contracts-import.csv',
          total: 3,
          success: 0,
          failed: 3,
          allowPartial: false,
        }),
      }),
    );
  });

  it('should import valid rows when allowPartial is enabled', async () => {
    prisma.dictionary.findMany.mockResolvedValueOnce([{ code: 'SERVICE', name: '服务合同' }]);
    prisma.customer.findMany.mockResolvedValueOnce([{ id: 'cus-1', name: '测试客户' }]);
    jest.spyOn(service, 'create').mockResolvedValue({ id: 'c-import-ok' } as any);

    const csv = Buffer.from(
      [
        '合同名称,客户名称,公司签约主体,合同类型,合同金额,签署日期,结束日期',
        '导入合同A,测试客户,InfFinanceMs,服务合同,1000,2026-03-18,2026-12-31',
        ',测试客户,InfFinanceMs,服务合同,1000,2026-03-18,2026-12-31',
      ].join('\n'),
      'utf-8',
    );

    const result = await service.importCsv(csv, { allowPartial: true });

    expect(result.total).toBe(2);
    expect(result.success).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(service.create).toHaveBeenCalledTimes(1);
    expect(prisma.contractImportLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          allowPartial: true,
          total: 2,
          success: 1,
          failed: 1,
        }),
      }),
    );
  });

  it('should return import history with sanitized errors and operator', async () => {
    prisma.contractImportLog.findMany.mockResolvedValueOnce([
      {
        id: 'log-1',
        fileName: 'contracts-a.csv',
        total: 5,
        success: 4,
        failed: 1,
        allowPartial: true,
        errors: [{ row: 2, message: '客户不存在' }, { row: 0, message: 'invalid' }],
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        operator: {
          id: 'u-1',
          name: '财务A',
          email: 'finance@inffinancems.com',
        },
      },
    ]);

    const result = await service.getImportHistory(10, 'u-1');

    expect(prisma.contractImportLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { operatorId: 'u-1' },
        take: 10,
      }),
    );
    expect(result).toEqual([
      {
        id: 'log-1',
        fileName: 'contracts-a.csv',
        total: 5,
        success: 4,
        failed: 1,
        allowPartial: true,
        errors: [{ row: 2, message: '客户不存在' }],
        createdAt: new Date('2026-03-18T10:00:00.000Z'),
        operator: {
          id: 'u-1',
          name: '财务A',
          email: 'finance@inffinancems.com',
        },
      },
    ]);
  });

  it('should clamp import history limit between 1 and 50', async () => {
    await service.getImportHistory(0);
    expect(prisma.contractImportLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 1,
      }),
    );

    await service.getImportHistory(999);
    expect(prisma.contractImportLog.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('should clear import history by operator scope', async () => {
    await service.clearImportHistory('u-1');
    expect(prisma.contractImportLog.deleteMany).toHaveBeenCalledWith({
      where: { operatorId: 'u-1' },
    });

    await service.clearImportHistory();
    expect(prisma.contractImportLog.deleteMany).toHaveBeenLastCalledWith({
      where: {},
    });
  });

  it('should export import error csv by log id', async () => {
    prisma.contractImportLog.findFirst.mockResolvedValueOnce({
      id: 'log-1',
      fileName: 'contracts-a.csv',
      errors: [{ row: 3, message: '合同金额无效' }],
    });

    const payload = await service.exportImportErrorCsv('log-1', 'u-1');

    expect(prisma.contractImportLog.findFirst).toHaveBeenCalledWith({
      where: { id: 'log-1', operatorId: 'u-1' },
      select: {
        id: true,
        fileName: true,
        errors: true,
      },
    });
    expect(payload.fileName).toContain('contracts-import-errors-log-1.csv');
    expect(payload.csv).toContain('行号');
    expect(payload.csv).toContain('合同金额无效');
  });

  it('should reject exporting error csv when log does not exist', async () => {
    prisma.contractImportLog.findFirst.mockResolvedValueOnce(null);
    await expect(service.exportImportErrorCsv('missing', 'u-1')).rejects.toThrow(NotFoundException);
  });

  it('should reject exporting error csv when log has no errors', async () => {
    prisma.contractImportLog.findFirst.mockResolvedValueOnce({
      id: 'log-1',
      fileName: 'contracts-a.csv',
      errors: [],
    });
    await expect(service.exportImportErrorCsv('log-1')).rejects.toThrow(BadRequestException);
  });
});
