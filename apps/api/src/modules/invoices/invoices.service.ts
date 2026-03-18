// InfFinanceMs - 发票服务

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';

// 发票状态常量
const InvoiceStatus = {
  ISSUED: 'ISSUED',
  VOIDED: 'VOIDED',
} as const;

const ALLOWED_INVOICE_SORT_FIELDS = [
  'invoiceNo',
  'invoiceType',
  'amount',
  'invoiceDate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取发票列表
   */
  async findAll(query: QueryInvoiceDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      contractId,
      invoiceType,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_INVOICE_SORT_FIELDS, 'createdAt');

    const where: any = {};

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { invoiceNo: { contains: keyword, mode: 'insensitive' } },
        { contract: { contractNo: { contains: keyword, mode: 'insensitive' } } },
        { contract: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    // 合同筛选
    if (contractId) {
      where.contractId = contractId;
    }

    // 发票类型筛选
    if (invoiceType) {
      where.invoiceType = invoiceType;
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = parseDateRangeStart(startDate);
      if (endDate) where.invoiceDate.lte = parseDateRangeEnd(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true,
              name: true,
              customer: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取发票详情
   */
  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('发票不存在');
    }

    return invoice;
  }

  /**
   * 创建发票
   */
  async create(createInvoiceDto: CreateInvoiceDto) {
    const { contractId, invoiceNo, invoiceType, amount, taxAmount, invoiceDate } = createInvoiceDto;

    // 验证合同
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    // 检查发票号是否重复
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { invoiceNo },
    });
    if (existingInvoice) {
      throw new BadRequestException('发票号码已存在');
    }

    // 检查开票金额是否超出合同金额
    const totalInvoiced = await this.prisma.invoice.aggregate({
      where: { contractId, status: InvoiceStatus.ISSUED },
      _sum: { amount: true },
    });
    const invoicedAmount = totalInvoiced._sum.amount || new Decimal(0);
    const newTotalInvoiced = invoicedAmount.plus(amount);

    if (newTotalInvoiced.gt(contract.amountWithTax)) {
      throw new BadRequestException('开票金额超出合同金额');
    }

    return this.prisma.invoice.create({
      data: {
        contractId,
        invoiceNo,
        invoiceType,
        amount,
        taxAmount,
        invoiceDate: new Date(invoiceDate),
      },
      include: {
        contract: {
          select: { id: true, contractNo: true, name: true },
        },
      },
    });
  }

  /**
   * 作废发票
   */
  async void(id: string) {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('发票已作废');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED },
    });
  }

  /**
   * 获取合同的开票风险预警
   */
  async getInvoiceRisk(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    // 计算已回款金额
    const totalPaid = await this.prisma.paymentRecord.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });
    const paidAmount = totalPaid._sum.amount || new Decimal(0);

    // 计算已开票金额
    const totalInvoiced = await this.prisma.invoice.aggregate({
      where: { contractId, status: InvoiceStatus.ISSUED },
      _sum: { amount: true },
    });
    const invoicedAmount = totalInvoiced._sum.amount || new Decimal(0);

    // 未开票金额 = 已回款 - 已开票
    const uninvoicedAmount = paidAmount.minus(invoicedAmount);

    return {
      contractId,
      paidAmount,
      invoicedAmount,
      uninvoicedAmount,
      hasRisk: uninvoicedAmount.gt(0),
      riskMessage: uninvoicedAmount.gt(0)
        ? `存在未开票风险，差额：${uninvoicedAmount.toFixed(2)}元`
        : null,
    };
  }
}
