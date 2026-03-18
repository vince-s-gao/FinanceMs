// InfFinanceMs - 预算服务

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { QueryBudgetDto } from './dto/query-budget.dto';
import { Decimal } from '@prisma/client/runtime/library';

// 预算状态常量
const BudgetStatus = {
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
};

@Injectable()
export class BudgetsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取预算列表
   */
  async findAll(query: QueryBudgetDto) {
    const {
      page = 1,
      pageSize = 20,
      year,
      month,
      department,
      feeType,
      status,
    } = query;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (year) where.year = year;
    if (month !== undefined) where.month = month;
    if (department) where.department = department;
    if (feeType) where.feeType = feeType;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { department: 'asc' }],
      }),
      this.prisma.budget.count({ where }),
    ]);

    // 计算预算使用率
    const itemsWithRate = items.map((item) => {
      const budgetAmount = new Decimal(item.budgetAmount.toString());
      const usedAmount = new Decimal(item.usedAmount.toString());
      const usageRate = budgetAmount.gt(0)
        ? usedAmount.div(budgetAmount).times(100).toNumber()
        : 0;
      const remainingAmount = budgetAmount.minus(usedAmount).toNumber();

      return {
        ...item,
        usageRate: Number(usageRate.toFixed(2)),
        remainingAmount,
        isOverBudget: usedAmount.gt(budgetAmount),
      };
    });

    return {
      items: itemsWithRate,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取预算详情
   */
  async findOne(id: string) {
    const budget = await this.prisma.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      throw new NotFoundException('预算不存在');
    }

    const budgetAmount = new Decimal(budget.budgetAmount.toString());
    const usedAmount = new Decimal(budget.usedAmount.toString());
    const usageRate = budgetAmount.gt(0)
      ? usedAmount.div(budgetAmount).times(100).toNumber()
      : 0;

    return {
      ...budget,
      usageRate: Number(usageRate.toFixed(2)),
      remainingAmount: budgetAmount.minus(usedAmount).toNumber(),
      isOverBudget: usedAmount.gt(budgetAmount),
    };
  }

  /**
   * 创建预算
   */
  async create(createBudgetDto: CreateBudgetDto) {
    const { year, month, department, feeType, budgetAmount, remark } = createBudgetDto;

    // 检查是否已存在相同预算
    const existing = await this.prisma.budget.findFirst({
      where: {
        year,
        month: month ?? null,
        department,
        feeType,
      },
    });

    if (existing) {
      throw new ConflictException('该部门在此时间段已存在相同费用类型的预算');
    }

    return this.prisma.budget.create({
      data: {
        year,
        month,
        department,
        feeType,
        budgetAmount,
        remark,
      },
    });
  }

  /**
   * 更新预算
   */
  async update(id: string, updateBudgetDto: UpdateBudgetDto) {
    const budget = await this.findOne(id);

    // 如果预算已关闭，不允许修改
    if (budget.status === BudgetStatus.CLOSED) {
      throw new BadRequestException('已关闭的预算不能修改');
    }

    return this.prisma.budget.update({
      where: { id },
      data: updateBudgetDto,
    });
  }

  /**
   * 删除预算
   */
  async remove(id: string) {
    const budget = await this.findOne(id);

    // 如果已有使用金额，不允许删除
    if (new Decimal(budget.usedAmount.toString()).gt(0)) {
      throw new BadRequestException('已有使用记录的预算不能删除');
    }

    return this.prisma.budget.delete({
      where: { id },
    });
  }

  /**
   * 冻结/解冻预算
   */
  async toggleFreeze(id: string) {
    const budget = await this.findOne(id);

    if (budget.status === BudgetStatus.CLOSED) {
      throw new BadRequestException('已关闭的预算不能操作');
    }

    const newStatus =
      budget.status === BudgetStatus.ACTIVE
        ? BudgetStatus.FROZEN
        : BudgetStatus.ACTIVE;

    return this.prisma.budget.update({
      where: { id },
      data: { status: newStatus as any },
    });
  }

  /**
   * 关闭预算
   */
  async close(id: string) {
    const budget = await this.findOne(id);

    if (budget.status === BudgetStatus.CLOSED) {
      throw new BadRequestException('预算已关闭');
    }

    return this.prisma.budget.update({
      where: { id },
      data: { status: BudgetStatus.CLOSED as any },
    });
  }

  /**
   * 获取部门预算汇总
   */
  async getDepartmentSummary(year: number, department: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { year, department },
    });

    let totalBudget = new Decimal(0);
    let totalUsed = new Decimal(0);

    const byFeeType: Record<string, { budget: number; used: number; rate: number }> = {};

    for (const budget of budgets) {
      const budgetAmount = new Decimal(budget.budgetAmount.toString());
      const usedAmount = new Decimal(budget.usedAmount.toString());

      totalBudget = totalBudget.plus(budgetAmount);
      totalUsed = totalUsed.plus(usedAmount);

      if (!byFeeType[budget.feeType]) {
        byFeeType[budget.feeType] = { budget: 0, used: 0, rate: 0 };
      }
      byFeeType[budget.feeType].budget += budgetAmount.toNumber();
      byFeeType[budget.feeType].used += usedAmount.toNumber();
    }

    // 计算各费用类型使用率
    for (const key of Object.keys(byFeeType)) {
      const item = byFeeType[key];
      item.rate = item.budget > 0 ? Number(((item.used / item.budget) * 100).toFixed(2)) : 0;
    }

    return {
      year,
      department,
      totalBudget: totalBudget.toNumber(),
      totalUsed: totalUsed.toNumber(),
      totalRemaining: totalBudget.minus(totalUsed).toNumber(),
      usageRate: totalBudget.gt(0)
        ? Number(totalUsed.div(totalBudget).times(100).toFixed(2))
        : 0,
      byFeeType,
    };
  }

  /**
   * 获取所有部门列表
   */
  async getDepartments() {
    const result = await this.prisma.budget.findMany({
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });

    return result.map((r) => r.department);
  }

  /**
   * 检查并更新预算使用金额（供报销模块调用）
   */
  async updateUsedAmount(
    department: string,
    feeType: string,
    amount: number,
    date: Date,
  ) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;

    // 先查找月度预算
    let budget = await this.prisma.budget.findFirst({
      where: {
        year,
        month,
        department,
        feeType: feeType as any,
        status: BudgetStatus.ACTIVE as any,
      },
    });

    // 如果没有月度预算，查找年度预算
    if (!budget) {
      budget = await this.prisma.budget.findFirst({
        where: {
          year,
          month: null,
          department,
          feeType: feeType as any,
          status: BudgetStatus.ACTIVE as any,
        },
      });
    }

    if (budget) {
      await this.prisma.budget.update({
        where: { id: budget.id },
        data: {
          usedAmount: {
            increment: amount,
          },
        },
      });
    }
  }
}
