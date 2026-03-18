// InfFinanceMs - 报销服务

import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CostsService } from '../costs/costs.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { QueryExpenseDto } from './dto/query-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { BudgetsService } from '../budgets/budgets.service';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';

// 导入 Prisma 生成的枚举类型
import { ExpenseStatus as PrismaExpenseStatus } from '@prisma/client';

// 报销状态常量（使用 Prisma 枚举）
const ExpenseStatus = PrismaExpenseStatus;

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
};
type RoleType = string;

// 费用来源常量
const CostSource = {
  DIRECT: 'DIRECT',
  REIMBURSEMENT: 'REIMBURSEMENT',
} as const;

const ALLOWED_EXPENSE_SORT_FIELDS = [
  'expenseNo',
  'totalAmount',
  'status',
  'submitDate',
  'approveDate',
  'paymentDate',
  'createdAt',
  'updatedAt',
] as const;

// 生成报销单号
function generateExpenseNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `BX${year}${month}-${String(sequence).padStart(4, '0')}`;
}

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private costsService: CostsService,
    private budgetsService: BudgetsService,
  ) {}

  /**
   * 生成报销单号
   */
  private async generateExpenseNo(now: Date): Promise<string> {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `BX${year}${month}-`;
    const lastExpense = await this.prisma.expense.findFirst({
      where: {
        expenseNo: { startsWith: prefix },
      },
      orderBy: { expenseNo: 'desc' },
      select: { expenseNo: true },
    });

    let sequence = 1;
    if (lastExpense?.expenseNo) {
      const match = lastExpense.expenseNo.match(/-(\d{4})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return generateExpenseNo(now, sequence);
  }

  private isExpenseNoConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes('expenseNo');
  }

  /**
   * 获取报销列表
   */
  async findAll(query: QueryExpenseDto, userId: string, userRole: RoleType) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_EXPENSE_SORT_FIELDS, 'createdAt');

    const where: any = {};

    // 员工只能看自己的报销
    if (userRole === Role.EMPLOYEE) {
      where.applicantId = userId;
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { expenseNo: { contains: keyword, mode: 'insensitive' } },
        { applicant: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = parseDateRangeStart(startDate);
      if (endDate) where.createdAt.lte = parseDateRangeEnd(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          applicant: {
            select: { id: true, name: true, department: true },
          },
          project: {
            select: { id: true, code: true, name: true },
          },
          contract: {
            select: { id: true, contractNo: true, name: true },
          },
          _count: {
            select: { details: true },
          },
        },
      }),
      this.prisma.expense.count({ where }),
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
   * 获取报销详情
   */
  async findOne(id: string, userId: string, userRole: RoleType) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        applicant: {
          select: { id: true, name: true, email: true, department: true },
        },
        project: {
          select: { id: true, code: true, name: true },
        },
        contract: {
          select: { id: true, contractNo: true, name: true },
        },
        details: {
          orderBy: { occurDate: 'asc' },
        },
      },
    });

    if (!expense) {
      throw new NotFoundException('报销单不存在');
    }

    // 员工只能查看自己的报销
    if (userRole === Role.EMPLOYEE && expense.applicantId !== userId) {
      throw new ForbiddenException('无权查看此报销单');
    }

    return expense;
  }

  /**
   * 创建报销单
   */
  async create(createExpenseDto: CreateExpenseDto, userId: string, department: string) {
    const { projectId, contractId, reason, details } = createExpenseDto;

    // 验证项目（必填）
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isDeleted: false },
    });
    if (!project) {
      throw new BadRequestException('关联项目不存在');
    }

    // 验证合同（如果有）
    if (contractId) {
      const contract = await this.prisma.contract.findFirst({
        where: { id: contractId, isDeleted: false },
      });
      if (!contract) {
        throw new BadRequestException('关联合同不存在');
      }
    }

    // 计算总金额
    const totalAmount = details.reduce(
      (sum, detail) => sum.plus(detail.amount),
      new Decimal(0),
    );

    // 并发场景下单号可能冲突，依赖唯一索引冲突自动重试
    for (let i = 0; i < 8; i++) {
      const expenseNo = await this.generateExpenseNo(new Date());
      try {
        return await this.prisma.expense.create({
          data: {
            expenseNo,
            applicantId: userId,
            department,
            projectId,
            contractId,
            reason,
            totalAmount,
            details: {
              create: details.map((detail) => ({
                ...detail,
                occurDate: new Date(detail.occurDate),
              })),
            },
          },
          include: {
            applicant: {
              select: { id: true, name: true, department: true },
            },
            project: {
              select: { id: true, code: true, name: true },
            },
            details: true,
          },
        });
      } catch (error) {
        if (this.isExpenseNoConflict(error) && i < 7) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('报销单号生成失败，请重试');
  }

  /**
   * 更新报销单
   */
  async update(id: string, updateExpenseDto: UpdateExpenseDto, userId: string, userRole: RoleType) {
    const expense = await this.findOne(id, userId, userRole);

    // 只有草稿和驳回状态可以编辑
    if (expense.status !== ExpenseStatus.DRAFT && expense.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException('当前状态不允许编辑');
    }

    // 员工只能编辑自己的报销
    if (userRole === Role.EMPLOYEE && expense.applicantId !== userId) {
      throw new ForbiddenException('无权编辑此报销单');
    }

    const { details, ...expenseData } = updateExpenseDto;

    // 计算新的总金额
    let totalAmount = expense.totalAmount;
    if (details) {
      totalAmount = details.reduce(
        (sum, detail) => sum.plus(detail.amount),
        new Decimal(0),
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 如果有新的明细，先删除旧的
      if (details) {
        await tx.expenseDetail.deleteMany({
          where: { expenseId: id },
        });
      }

      return tx.expense.update({
        where: { id },
        data: {
          ...expenseData,
          totalAmount,
          status: ExpenseStatus.DRAFT, // 重新编辑后回到草稿状态
          rejectReason: null,
          details: details
            ? {
                create: details.map((detail) => ({
                  ...detail,
                  occurDate: new Date(detail.occurDate),
                })),
              }
            : undefined,
        },
        include: {
          applicant: {
            select: { id: true, name: true, department: true },
          },
          details: true,
        },
      });
    });
  }

  /**
   * 提交报销单
   */
  async submit(id: string, userId: string, userRole: RoleType) {
    const expense = await this.findOne(id, userId, userRole);

    // 只有草稿和驳回状态可以提交
    if (expense.status !== ExpenseStatus.DRAFT && expense.status !== ExpenseStatus.REJECTED) {
      throw new BadRequestException('当前状态不允许提交');
    }

    // 员工只能提交自己的报销
    if (userRole === Role.EMPLOYEE && expense.applicantId !== userId) {
      throw new ForbiddenException('无权提交此报销单');
    }

    // 检查是否有明细
    if (expense.details.length === 0) {
      throw new BadRequestException('报销单没有明细，无法提交');
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        status: ExpenseStatus.PENDING,
        submitDate: new Date(),
        rejectReason: null,
      },
    });
  }

  /**
   * 审批报销单
   */
  async approve(id: string, approveDto: ApproveExpenseDto) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException('报销单不存在');
    }

    // 只有审批中状态可以审批
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('当前状态不允许审批');
    }

    const { approved, rejectReason } = approveDto;

    if (approved) {
      return this.prisma.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.APPROVED,
          approveDate: new Date(),
        },
      });
    } else {
      if (!rejectReason) {
        throw new BadRequestException('驳回时必须填写原因');
      }
      return this.prisma.expense.update({
        where: { id },
        data: {
          status: ExpenseStatus.REJECTED,
          rejectReason,
        },
      });
    }
  }

  /**
   * 报销打款
   */
  async pay(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { details: true },
    });

    if (!expense) {
      throw new NotFoundException('报销单不存在');
    }

    // 只有已批准状态可以打款
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException('当前状态不允许打款');
    }

    // 使用事务：更新状态并生成费用记录
    return this.prisma.$transaction(async (tx) => {
      // 仅允许 APPROVED -> PAID，避免并发重复打款
      const updateResult = await tx.expense.updateMany({
        where: {
          id,
          status: ExpenseStatus.APPROVED,
        },
        data: {
          status: ExpenseStatus.PAID,
          paymentDate: new Date(),
        },
      });

      if (updateResult.count === 0) {
        const latest = await tx.expense.findUnique({
          where: { id },
          select: { status: true },
        });

        if (!latest) {
          throw new NotFoundException('报销单不存在');
        }

        if (latest.status === ExpenseStatus.PAID) {
          throw new BadRequestException('该报销单已打款');
        }

        throw new BadRequestException('当前状态不允许打款');
      }

      const existingGeneratedCosts = await tx.cost.count({
        where: {
          expenseId: id,
          source: CostSource.REIMBURSEMENT,
        },
      });

      if (existingGeneratedCosts > 0) {
        throw new ConflictException('该报销单已生成费用记录，请勿重复打款');
      }

      // 为每个明细生成费用记录
      for (const detail of expense.details) {
        await tx.cost.create({
          data: {
            feeType: detail.feeType,
            amount: detail.amount,
            occurDate: detail.occurDate,
            source: CostSource.REIMBURSEMENT,
            expenseId: expense.id,
            projectId: expense.projectId, // 关联项目
            contractId: expense.contractId,
            description: detail.description,
          },
        });

        await this.budgetsService.updateUsedAmount(
          expense.department,
          detail.feeType,
          Number(detail.amount),
          detail.occurDate,
          tx,
        );
      }

      return tx.expense.findUnique({
        where: { id },
      });
    });
  }

  /**
   * 删除报销单
   */
  async remove(id: string, userId: string, userRole: RoleType) {
    const expense = await this.findOne(id, userId, userRole);

    // 只有草稿状态可以删除
    if (expense.status !== ExpenseStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的报销单可以删除');
    }

    // 员工只能删除自己的报销
    if (userRole === Role.EMPLOYEE && expense.applicantId !== userId) {
      throw new ForbiddenException('无权删除此报销单');
    }

    return this.prisma.expense.delete({
      where: { id },
    });
  }
}
