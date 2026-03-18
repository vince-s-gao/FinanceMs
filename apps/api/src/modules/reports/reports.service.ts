// InfFinanceMs - 报表服务

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// 状态常量
const ContractStatus = {
  DRAFT: 'DRAFT',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;

const ExpenseStatus = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  PAID: 'PAID',
} as const;

const InvoiceStatus = {
  ISSUED: 'ISSUED',
  VOIDED: 'VOIDED',
} as const;

// 计算账龄
function calculateAging(dueDate: Date | string): number {
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due >= today) return 0;
  return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

// 获取账龄分段
function getAgingBucket(agingDays: number): 'normal' | '0-30' | '31-90' | '90+' {
  if (agingDays <= 0) return 'normal';
  if (agingDays <= 30) return '0-30';
  if (agingDays <= 90) return '31-90';
  return '90+';
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 应收账款总览
   */
  async getReceivablesOverview() {
    // 获取所有执行中的合同
    const contracts = await this.prisma.contract.findMany({
      where: {
        isDeleted: false,
        status: { in: [ContractStatus.EXECUTING, ContractStatus.COMPLETED] },
      },
      include: {
        paymentPlans: true,
        paymentRecords: true,
      },
    });

    let totalContractAmount = new Decimal(0);
    let totalReceived = new Decimal(0);
    const agingDistribution = {
      normal: new Decimal(0),
      days0to30: new Decimal(0),
      days31to90: new Decimal(0),
      daysOver90: new Decimal(0),
    };

    for (const contract of contracts) {
      totalContractAmount = totalContractAmount.plus(contract.amountWithTax);

      const contractReceived = contract.paymentRecords.reduce(
        (sum, record) => sum.plus(record.amount),
        new Decimal(0),
      );
      totalReceived = totalReceived.plus(contractReceived);

      // 计算账龄
      const receivable = new Decimal(contract.amountWithTax.toString()).minus(contractReceived);
      if (receivable.gt(0)) {
        // 找到最早的逾期回款计划
        const overduePlans = contract.paymentPlans
          .filter((plan) => plan.status !== 'COMPLETED' && new Date(plan.planDate) < new Date())
          .sort((a, b) => new Date(a.planDate).getTime() - new Date(b.planDate).getTime());

        if (overduePlans.length > 0) {
          const agingDays = calculateAging(overduePlans[0].planDate);
          const bucket = getAgingBucket(agingDays);

          switch (bucket) {
            case 'normal':
              agingDistribution.normal = agingDistribution.normal.plus(receivable);
              break;
            case '0-30':
              agingDistribution.days0to30 = agingDistribution.days0to30.plus(receivable);
              break;
            case '31-90':
              agingDistribution.days31to90 = agingDistribution.days31to90.plus(receivable);
              break;
            case '90+':
              agingDistribution.daysOver90 = agingDistribution.daysOver90.plus(receivable);
              break;
          }
        } else {
          agingDistribution.normal = agingDistribution.normal.plus(receivable);
        }
      }
    }

    return {
      totalContractAmount: totalContractAmount.toNumber(),
      totalReceived: totalReceived.toNumber(),
      totalReceivable: totalContractAmount.minus(totalReceived).toNumber(),
      agingDistribution: {
        normal: agingDistribution.normal.toNumber(),
        days0to30: agingDistribution.days0to30.toNumber(),
        days31to90: agingDistribution.days31to90.toNumber(),
        daysOver90: agingDistribution.daysOver90.toNumber(),
      },
    };
  }

  /**
   * 客户维度报表
   */
  async getCustomerReport() {
    const customers = await this.prisma.customer.findMany({
      where: { isDeleted: false },
      include: {
        contracts: {
          where: { isDeleted: false },
          include: {
            paymentPlans: true,
            paymentRecords: true,
          },
        },
      },
    });

    return customers.map((customer) => {
      let totalAmount = new Decimal(0);
      let receivedAmount = new Decimal(0);
      let overdueOver90 = new Decimal(0);

      for (const contract of customer.contracts) {
        totalAmount = totalAmount.plus(contract.amountWithTax);

        const contractReceived = contract.paymentRecords.reduce(
          (sum, record) => sum.plus(record.amount),
          new Decimal(0),
        );
        receivedAmount = receivedAmount.plus(contractReceived);

        // 计算90天以上逾期
        const receivable = new Decimal(contract.amountWithTax.toString()).minus(contractReceived);
        if (receivable.gt(0)) {
          const overduePlans = contract.paymentPlans
            .filter((plan) => plan.status !== 'COMPLETED' && new Date(plan.planDate) < new Date())
            .sort((a, b) => new Date(a.planDate).getTime() - new Date(b.planDate).getTime());

          if (overduePlans.length > 0) {
            const agingDays = calculateAging(overduePlans[0].planDate);
            if (agingDays > 90) {
              overdueOver90 = overdueOver90.plus(receivable);
            }
          }
        }
      }

      return {
        customerId: customer.id,
        customerName: customer.name,
        contractCount: customer.contracts.length,
        totalAmount: totalAmount.toNumber(),
        receivedAmount: receivedAmount.toNumber(),
        receivableAmount: totalAmount.minus(receivedAmount).toNumber(),
        overdueOver90: overdueOver90.toNumber(),
      };
    });
  }

  /**
   * 报销分析
   */
  async getExpenseAnalysis() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // 本月已打款报销总额
    const monthlyPaid = await this.prisma.expense.aggregate({
      where: {
        status: ExpenseStatus.PAID,
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    // 待审批报销
    const pending = await this.prisma.expense.aggregate({
      where: { status: ExpenseStatus.PENDING },
      _sum: { totalAmount: true },
      _count: true,
    });

    // 待打款报销
    const approved = await this.prisma.expense.aggregate({
      where: { status: ExpenseStatus.APPROVED },
      _sum: { totalAmount: true },
      _count: true,
    });

    // 无票金额统计
    const allDetails = await this.prisma.expenseDetail.aggregate({
      _sum: { amount: true },
    });
    const noInvoiceDetails = await this.prisma.expenseDetail.aggregate({
      where: { hasInvoice: false },
      _sum: { amount: true },
    });

    const totalDetailAmount = allDetails._sum.amount || new Decimal(0);
    const noInvoiceAmount = noInvoiceDetails._sum.amount || new Decimal(0);
    const noInvoiceRatio = totalDetailAmount.gt(0)
      ? noInvoiceAmount.div(totalDetailAmount).times(100).toNumber()
      : 0;

    return {
      monthlyTotal: (monthlyPaid._sum.totalAmount || new Decimal(0)).toNumber(),
      monthlyCount: monthlyPaid._count,
      pendingCount: pending._count,
      pendingAmount: (pending._sum.totalAmount || new Decimal(0)).toNumber(),
      unpaidCount: approved._count,
      unpaidAmount: (approved._sum.totalAmount || new Decimal(0)).toNumber(),
      noInvoiceRatio: Number(noInvoiceRatio.toFixed(2)),
    };
  }

  /**
   * 合同执行看板
   */
  async getContractDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 执行中合同数
    const executingCount = await this.prisma.contract.count({
      where: { status: ContractStatus.EXECUTING, isDeleted: false },
    });

    // 本月新签合同
    const monthlyNew = await this.prisma.contract.aggregate({
      where: {
        signDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
        isDeleted: false,
      },
      _sum: { amountWithTax: true },
      _count: true,
    });

    // 本月回款
    const monthlyPayment = await this.prisma.paymentRecord.aggregate({
      where: {
        paymentDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _sum: { amount: true },
    });

    // 即将到期的回款计划（7天内）
    const upcomingPayments = await this.prisma.paymentPlan.findMany({
      where: {
        status: { not: 'COMPLETED' },
        planDate: {
          gte: now,
          lte: sevenDaysLater,
        },
      },
      include: {
        contract: {
          select: { id: true, contractNo: true, name: true },
        },
      },
      orderBy: { planDate: 'asc' },
    });

    return {
      executingCount,
      monthlyNewCount: monthlyNew._count,
      monthlyNewAmount: (monthlyNew._sum.amountWithTax || new Decimal(0)).toNumber(),
      monthlyPaymentAmount: (monthlyPayment._sum.amount || new Decimal(0)).toNumber(),
      upcomingPayments: upcomingPayments.map((plan) => ({
        planId: plan.id,
        contractId: plan.contract.id,
        contractNo: plan.contract.contractNo,
        contractName: plan.contract.name,
        period: plan.period,
        planAmount: plan.planAmount,
        planDate: plan.planDate,
        daysUntilDue: Math.ceil(
          (new Date(plan.planDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      })),
    };
  }

  /**
   * 合同毛利分析
   */
  async getContractProfitAnalysis(contractId?: string) {
    const where: any = {
      isDeleted: false,
      status: { in: [ContractStatus.EXECUTING, ContractStatus.COMPLETED] },
    };

    if (contractId) {
      where.id = contractId;
    }

    const contracts = await this.prisma.contract.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true },
        },
        paymentRecords: true,
        costs: true,
      },
    });

    return contracts.map((contract) => {
      const totalReceived = contract.paymentRecords.reduce(
        (sum, record) => sum.plus(record.amount),
        new Decimal(0),
      );

      const totalCost = contract.costs.reduce(
        (sum, cost) => sum.plus(cost.amount),
        new Decimal(0),
      );

      const profit = totalReceived.minus(totalCost);
      const profitRate = totalReceived.gt(0)
        ? profit.div(totalReceived).times(100).toNumber()
        : 0;

      return {
        contractId: contract.id,
        contractNo: contract.contractNo,
        contractName: contract.name,
        customerName: contract.customer.name,
        contractAmount: contract.amountWithTax,
        totalReceived: totalReceived.toNumber(),
        totalCost: totalCost.toNumber(),
        profit: profit.toNumber(),
        profitRate: Number(profitRate.toFixed(2)),
        isLoss: profit.lt(0),
      };
    });
  }
}
