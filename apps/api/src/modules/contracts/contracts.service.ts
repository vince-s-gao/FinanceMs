// InfFinanceMs - 合同服务

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';

// 合同状态常量
const ContractStatus = {
  DRAFT: 'DRAFT',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;
type ContractStatusType = typeof ContractStatus[keyof typeof ContractStatus];

const ALLOWED_CONTRACT_SORT_FIELDS = [
  'contractNo',
  'name',
  'amountWithTax',
  'signDate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

// 生成合同编号
function generateContractNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `HT${year}${month}-${String(sequence).padStart(4, '0')}`;
}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成合同编号
   */
  private async generateContractNo(now: Date): Promise<string> {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `HT${year}${month}-`;
    const lastContract = await this.prisma.contract.findFirst({
      where: {
        contractNo: {
          startsWith: prefix,
        },
      },
      orderBy: { contractNo: 'desc' },
      select: { contractNo: true },
    });

    let sequence = 1;
    if (lastContract?.contractNo) {
      const match = lastContract.contractNo.match(/-(\d{4})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return generateContractNo(now, sequence);
  }

  private isContractNoConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes('contractNo');
  }

  /**
   * 获取合同列表
   */
  async findAll(query: QueryContractDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      customerId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_CONTRACT_SORT_FIELDS, 'createdAt');

    const where: any = {
      isDeleted: false,
    };

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { contractNo: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        { customer: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 客户筛选
    if (customerId) {
      where.customerId = customerId;
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.signDate = {};
      if (startDate) where.signDate.gte = parseDateRangeStart(startDate);
      if (endDate) where.signDate.lte = parseDateRangeEnd(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              paymentRecords: true,
              invoices: true,
            },
          },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    // 批量聚合回款，避免 N+1 查询
    const contractIds = items.map((item) => item.id);
    const paymentSums = contractIds.length
      ? await this.prisma.paymentRecord.groupBy({
          by: ['contractId'],
          where: {
            contractId: { in: contractIds },
          },
          _sum: { amount: true },
        })
      : [];

    const paymentMap = new Map(
      paymentSums.map((row) => [row.contractId, row._sum.amount || new Decimal(0)]),
    );

    const itemsWithPayment = items.map((contract) => {
      const totalPaid = paymentMap.get(contract.id) || new Decimal(0);
      return {
        ...contract,
        totalPaid,
        receivable: new Decimal(contract.amountWithTax.toString()).minus(totalPaid),
      };
    });

    return {
      items: itemsWithPayment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取合同详情
   */
  async findOne(id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, isDeleted: false },
      include: {
        customer: true,
        paymentPlans: {
          orderBy: { period: 'asc' },
        },
        paymentRecords: {
          orderBy: { paymentDate: 'desc' },
        },
        invoices: {
          orderBy: { invoiceDate: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    // 计算汇总数据
    const totalPaid = contract.paymentRecords.reduce(
      (sum, record) => sum.plus(record.amount),
      new Decimal(0),
    );
    const totalInvoiced = contract.invoices
      .filter((inv) => inv.status === 'ISSUED')
      .reduce((sum, inv) => sum.plus(inv.amount), new Decimal(0));

    return {
      ...contract,
      summary: {
        totalPaid,
        receivable: new Decimal(contract.amountWithTax.toString()).minus(totalPaid),
        totalInvoiced,
        uninvoiced: totalPaid.minus(totalInvoiced),
        paymentProgress: totalPaid
          .div(contract.amountWithTax)
          .times(100)
          .toFixed(2),
      },
    };
  }

  /**
   * 创建合同
   */
  async create(createContractDto: CreateContractDto) {
    // 验证客户是否存在
    const customer = await this.prisma.customer.findFirst({
      where: { id: createContractDto.customerId, isDeleted: false },
    });
    if (!customer) {
      throw new BadRequestException('客户不存在');
    }

    // 并发下可能出现编号冲突，依赖唯一索引进行重试
    for (let i = 0; i < 8; i++) {
      const contractNo = await this.generateContractNo(new Date());
      try {
        return await this.prisma.contract.create({
          data: {
            ...createContractDto,
            contractNo,
            signDate: new Date(createContractDto.signDate),
            startDate: createContractDto.startDate ? new Date(createContractDto.startDate) : null,
            endDate: createContractDto.endDate ? new Date(createContractDto.endDate) : null,
          },
          include: {
            customer: {
              select: { id: true, name: true, code: true },
            },
          },
        });
      } catch (error) {
        if (this.isContractNoConflict(error)) {
          if (i < 7) {
            continue;
          }
          break;
        }
        throw error;
      }
    }

    throw new ConflictException('合同编号生成失败，请重试');
  }

  /**
   * 更新合同
   */
  async update(id: string, updateContractDto: UpdateContractDto) {
    const contract = await this.findOne(id);

    // 只有草稿状态可以编辑
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的合同可以编辑');
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...updateContractDto,
        signDate: updateContractDto.signDate ? new Date(updateContractDto.signDate) : undefined,
        startDate: updateContractDto.startDate ? new Date(updateContractDto.startDate) : undefined,
        endDate: updateContractDto.endDate ? new Date(updateContractDto.endDate) : undefined,
      },
      include: {
        customer: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  /**
   * 变更合同状态
   */
  async changeStatus(id: string, changeStatusDto: ChangeStatusDto) {
    const contract = await this.findOne(id);
    const { status } = changeStatusDto;

    // 状态流转校验
    const validTransitions: Record<string, string[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.EXECUTING],
      [ContractStatus.EXECUTING]: [ContractStatus.COMPLETED, ContractStatus.TERMINATED],
      [ContractStatus.COMPLETED]: [],
      [ContractStatus.TERMINATED]: [],
    };

    if (!validTransitions[contract.status]?.includes(status)) {
      throw new BadRequestException(
        `不能从 ${contract.status} 状态变更为 ${status} 状态`,
      );
    }

    return this.prisma.contract.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * 删除合同（软删除）
   */
  async remove(id: string) {
    const contract = await this.findOne(id);

    // 只有草稿状态可以删除
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的合同可以删除');
    }

    return this.prisma.contract.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  /**
   * 对账合同状态：根据回款金额在 EXECUTING/COMPLETED 之间自动同步
   */
  async reconcileContractStatus(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (
      !contract ||
      (contract.status !== ContractStatus.EXECUTING &&
        contract.status !== ContractStatus.COMPLETED)
    ) {
      return;
    }

    const totalPaid = await this.prisma.paymentRecord.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });

    const paidAmount = totalPaid._sum.amount || new Decimal(0);
    const nextStatus = paidAmount.gte(contract.amountWithTax)
      ? ContractStatus.COMPLETED
      : ContractStatus.EXECUTING;

    if (contract.status !== nextStatus) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: nextStatus },
      });
    }
  }

  /**
   * 兼容旧调用
   */
  async checkAndCompleteContract(contractId: string) {
    return this.reconcileContractStatus(contractId);
  }
}
