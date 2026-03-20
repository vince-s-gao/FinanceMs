import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;
  let uploadService: any;

  beforeEach(() => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
      contract: {
        findFirst: jest.fn(),
      },
      paymentRecord: {
        aggregate: jest.fn(),
      },
      dictionary: {
        findMany: jest.fn().mockResolvedValue([
          { code: 'SALES', name: '销售合同', value: '销售' },
          { code: 'PURCHASE', name: '采购合同', value: '采购' },
        ]),
      },
    };
    uploadService = {
      saveFile: jest.fn(),
      deleteFile: jest.fn(),
    };

    service = new InvoicesService(prisma, uploadService);
  });

  it('should fallback to createdAt when sortBy is invalid', async () => {
    await service.findAll({
      sortBy: 'invalidField',
      sortOrder: 'desc',
    } as any);

    const findManyArg = prisma.invoice.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should respect allowed sortBy field', async () => {
    await service.findAll({
      sortBy: 'invoiceDate',
      sortOrder: 'asc',
    } as any);

    const findManyArg = prisma.invoice.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ invoiceDate: 'asc' });
  });

  it('should use full-day range for date-only filters', async () => {
    await service.findAll({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    } as any);

    const where = prisma.invoice.findMany.mock.calls[0][0].where;
    expect(where.invoiceDate.gte).toBeInstanceOf(Date);
    expect(where.invoiceDate.lte).toBeInstanceOf(Date);
    expect(where.invoiceDate.gte.getHours()).toBe(0);
    expect(where.invoiceDate.lte.getHours()).toBe(23);
  });

  it('should apply filters and pagination in findAll', async () => {
    prisma.invoice.findMany.mockResolvedValueOnce([{ id: 'inv1' }]);
    prisma.invoice.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      keyword: 'INV',
      contractId: 'c1',
      invoiceType: 'VAT_SPECIAL',
      status: 'ISSUED',
    } as any);

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contractId: 'c1',
          invoiceType: 'VAT_SPECIAL',
          status: 'ISSUED',
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(1);
  });

  it('should apply direction filter based on contract type for outbound invoices', async () => {
    await service.findAll({
      direction: 'OUTBOUND',
    } as any);

    const findManyArg = prisma.invoice.findMany.mock.calls[0][0];
    expect(findManyArg.where.contract.contractType.in).toContain('SALES');
  });

  it('should throw when findOne invoice does not exist', async () => {
    prisma.invoice.findUnique.mockResolvedValueOnce(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should throw when creating invoice for missing contract', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.create({
        contractId: 'contract-1',
        invoiceNo: 'INV-001',
        invoiceType: 'VAT_SPECIAL',
        amount: 100,
        taxAmount: 10,
        invoiceDate: '2026-03-17',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject duplicate invoice number', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: 'contract-1',
      amountWithTax: new Decimal(1000),
      isDeleted: false,
    });
    prisma.invoice.findFirst.mockResolvedValueOnce({ id: 'inv-dup' });

    await expect(
      service.create({
        contractId: 'contract-1',
        invoiceNo: 'INV-001',
        invoiceType: 'VAT_SPECIAL',
        amount: 200,
        taxAmount: 10,
        invoiceDate: '2026-03-17',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject when invoiced amount exceeds contract total', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: 'contract-1',
      amountWithTax: new Decimal(500),
      isDeleted: false,
    });
    prisma.invoice.findFirst.mockResolvedValueOnce(null);
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(450) },
    });

    await expect(
      service.create({
        contractId: 'contract-1',
        invoiceNo: 'INV-001',
        invoiceType: 'VAT_SPECIAL',
        amount: 100,
        taxAmount: 10,
        invoiceDate: '2026-03-17',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create invoice when amount does not exceed contract', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: 'contract-1',
      amountWithTax: new Decimal(1000),
      isDeleted: false,
    });
    prisma.invoice.findFirst.mockResolvedValueOnce(null);
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(300) },
    });
    prisma.invoice.create.mockResolvedValueOnce({
      id: 'inv-1',
      amount: new Decimal(200),
    });

    const result = await service.create({
      contractId: 'contract-1',
      invoiceNo: 'INV-001',
      invoiceType: 'VAT_SPECIAL',
      amount: 200,
      taxAmount: 10,
      invoiceDate: '2026-03-17',
    } as any);

    expect(result).toEqual({ id: 'inv-1', amount: new Decimal(200) });
    expect(prisma.invoice.create).toHaveBeenCalledTimes(1);
  });

  it('should treat null existing invoiced amount as zero when creating invoice', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({
      id: 'contract-2',
      amountWithTax: new Decimal(1000),
      isDeleted: false,
    });
    prisma.invoice.findFirst.mockResolvedValueOnce(null);
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });
    prisma.invoice.create.mockResolvedValueOnce({
      id: 'inv-2',
      amount: new Decimal(100),
    });

    const result = await service.create({
      contractId: 'contract-2',
      invoiceNo: 'INV-002',
      invoiceType: 'VAT_NORMAL',
      amount: 100,
      taxAmount: 5,
      invoiceDate: '2026-03-18',
    } as any);

    expect(result.id).toBe('inv-2');
    expect(prisma.invoice.create).toHaveBeenCalled();
  });

  it('should reject voiding already voided invoice', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'inv-1',
      status: 'VOIDED',
    } as any);

    await expect(service.void('inv-1')).rejects.toThrow(BadRequestException);
  });

  it('should void issued invoice', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({
      id: 'inv-1',
      status: 'ISSUED',
    } as any);
    prisma.invoice.update.mockResolvedValueOnce({ id: 'inv-1', status: 'VOIDED' });

    await service.void('inv-1');

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'VOIDED' },
    });
  });

  it('should throw in getInvoiceRisk when contract does not exist', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce(null);
    await expect(service.getInvoiceRisk('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return risk data when paid exceeds invoiced', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({ id: 'c1', isDeleted: false });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(500) },
    });
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(200) },
    });

    const result = await service.getInvoiceRisk('c1');

    expect(result.hasRisk).toBe(true);
    expect(result.uninvoicedAmount.toString()).toBe('300');
    expect(result.riskMessage).toContain('存在未开票风险');
  });

  it('should return no risk when paid does not exceed invoiced', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({ id: 'c1', isDeleted: false });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(200) },
    });
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(200) },
    });

    const result = await service.getInvoiceRisk('c1');
    expect(result.hasRisk).toBe(false);
    expect(result.riskMessage).toBeNull();
  });

  it('should fallback paid/invoiced aggregates to zero in invoice risk', async () => {
    prisma.contract.findFirst.mockResolvedValueOnce({ id: 'c2', isDeleted: false });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });
    prisma.invoice.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });

    const result = await service.getInvoiceRisk('c2');
    expect(result.paidAmount.toString()).toBe('0');
    expect(result.invoicedAmount.toString()).toBe('0');
    expect(result.uninvoicedAmount.toString()).toBe('0');
    expect(result.hasRisk).toBe(false);
    expect(result.riskMessage).toBeNull();
  });

  it('should preview parsed invoice attachment rows', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'contract-1', isDeleted: false });
    const file = {
      originalname: '发票号码88886666_金额1000.50_日期2026-03-18_专票.pdf',
      buffer: Buffer.from(''),
      mimetype: 'application/pdf',
      size: 1024,
    } as Express.Multer.File;

    const result = await service.previewImportFiles([file], 'contract-1');
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.invalid).toBe(0);
    expect(result.samples[0].invoiceNo).toContain('88886666');
    expect(result.samples[0].invoiceType).toBe('VAT_SPECIAL');
    expect(result.samples[0].invoiceDate).toBe('2026-03-18');
  });

  it('should parse pdf text instead of binary metadata noise', async () => {
    const file = {
      originalname: '词元无限 910房间 Q1房租发票.pdf',
      buffer: Buffer.from('fake-pdf'),
      mimetype: 'application/pdf',
      size: 4096,
    } as Express.Multer.File;

    jest.spyOn(service as any, 'extractAttachmentText').mockResolvedValue(
      [
        '电子发票（增值税专用发票）',
        '发票号码：26112000000347783971',
        '开票日期：2026年01月27日',
        '价税合计（小写）¥86700.00',
        'CreationDate:2012-08-23',
        'PDF-1.7 amount:1.00',
      ].join('\n'),
    );

    const parsed = await (service as any).parseAttachmentFile(file, 1, 'contract-1');
    expect(parsed.error).toBeUndefined();
    expect(parsed.candidate.invoiceNo).toBe('26112000000347783971');
    expect(parsed.candidate.amount).toBe(86700);
    expect(parsed.candidate.invoiceDate).toBe('2026-01-27');
  });

  it('should not parse long invoice number as amount for attachment pdf', async () => {
    const file = {
      originalname: 'dzfp_26112000000065517391_国耀融汇融资租赁有限公司_20260106161428.pdf',
      buffer: Buffer.from('fake-pdf'),
      mimetype: 'application/pdf',
      size: 4096,
    } as Express.Multer.File;

    jest.spyOn(service as any, 'extractAttachmentText').mockResolvedValue(
      [
        '电子发票（增值税专用发票） 发票号码：',
        '开票日期：',
        '价税合计（大写） （小写）',
        '开票人：',
        '26112000000065517391',
        '2026年01月06日',
        '¥3537.74  ¥212.26',
        '叁仟柒佰伍拾圆整  ¥3750.00',
        '6% 3537.74 212.26',
      ].join('\n'),
    );

    const parsed = await (service as any).parseAttachmentFile(file, 1, 'contract-1');
    expect(parsed.error).toBeUndefined();
    expect(parsed.candidate.invoiceNo).toBe('26112000000065517391');
    expect(parsed.candidate.amount).toBe(3750);
    expect(parsed.candidate.taxAmount).toBe(212.26);
    expect(parsed.candidate.invoiceDate).toBe('2026-01-06');
  });

  it('should import parsed invoice files and save attachment', async () => {
    prisma.contract.findFirst.mockResolvedValue({ id: 'contract-1', isDeleted: false });
    uploadService.saveFile.mockResolvedValue({
      url: '/uploads/invoices/test.pdf',
      filename: 'stored-test.pdf',
      originalName: 'test.pdf',
    });
    const createSpy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'inv-1001' } as any);

    const file = {
      originalname: '发票号码18889999_金额2000_日期2026-03-19_普票.pdf',
      buffer: Buffer.from(''),
      mimetype: 'application/pdf',
      size: 512,
    } as Express.Multer.File;

    const result = await service.importFiles([file], {
      contractId: 'contract-1',
      allowPartial: false,
    });

    expect(uploadService.saveFile).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: 'contract-1',
        attachmentUrl: '/uploads/invoices/test.pdf',
        attachmentName: 'test.pdf',
      }),
    );
    expect(result.success).toBe(1);
    expect(result.failed).toBe(0);
    createSpy.mockRestore();
  });
});
