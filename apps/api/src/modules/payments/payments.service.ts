// InfFinanceMs - 回款服务

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { ContractsService } from "../contracts/contracts.service";
import { CreatePaymentPlanDto } from "./dto/create-payment-plan.dto";
import { CreatePaymentRecordDto } from "./dto/create-payment-record.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { isSalesContractType } from "../contracts/contracts.type.utils";
import { normalizeText } from "../../common/utils/tabular.utils";

// 合同状态常量
const ContractStatus = {
  DRAFT: "DRAFT",
  EXECUTING: "EXECUTING",
  COMPLETED: "COMPLETED",
  TERMINATED: "TERMINATED",
} as const;

// 导入 Prisma 生成的枚举类型
import { PaymentPlanStatus as PrismaPaymentPlanStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";

// 回款计划状态常量（使用 Prisma 枚举）
const PaymentPlanStatus = PrismaPaymentPlanStatus;
const SALES_CONTRACT_TYPES_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PaymentsService {
  private salesContractTypesCache: {
    codes: string[];
    expiresAt: number;
  } | null = null;

  constructor(
    private prisma: PrismaService,
    private contractsService: ContractsService,
  ) {}

  private async getSalesContractTypeCodes(): Promise<string[]> {
    const now = Date.now();
    if (
      this.salesContractTypesCache &&
      this.salesContractTypesCache.expiresAt > now
    ) {
      return this.salesContractTypesCache.codes;
    }

    const rows = await this.prisma.dictionary.findMany({
      where: { type: "CONTRACT_TYPE" },
      select: { code: true, name: true, value: true },
    });

    const detected = rows
      .filter((row) =>
        isSalesContractType([row.code, row.name || "", row.value || ""]),
      )
      .map((row) => normalizeText(row.code).toUpperCase())
      .filter(Boolean);

    const fallback = ["SALES"];
    const resolved = [...new Set([...detected, ...fallback])];

    this.salesContractTypesCache = {
      codes: resolved,
      expiresAt: now + SALES_CONTRACT_TYPES_CACHE_TTL_MS,
    };

    return resolved;
  }

  private async isSalesContract(
    contractType?: string | null,
  ): Promise<boolean> {
    const normalized = normalizeText(contractType || "").toUpperCase();
    if (!normalized) return false;

    const salesCodes = await this.getSalesContractTypeCodes();
    if (salesCodes.includes(normalized)) return true;

    return isSalesContractType([contractType || ""]);
  }

  private async assertSalesContract(
    contractType?: string | null,
  ): Promise<void> {
    const isSales = await this.isSalesContract(contractType);
    if (!isSales) {
      throw new BadRequestException("仅销售合同支持回款管理");
    }
  }

  /**
   * 重新计算并更新回款计划状态
   */
  private async refreshPlanStatus(
    tx: Prisma.TransactionClient,
    planId: string,
  ): Promise<void> {
    const plan = await tx.paymentPlan.findUnique({
      where: { id: planId },
      select: { id: true, planAmount: true },
    });

    if (!plan) return;

    const planPaid = await tx.paymentRecord.aggregate({
      where: { planId },
      _sum: { amount: true },
    });

    const paidAmount = planPaid._sum.amount || new Decimal(0);
    let status: PrismaPaymentPlanStatus = PaymentPlanStatus.PENDING;
    if (paidAmount.gte(plan.planAmount)) {
      status = PaymentPlanStatus.COMPLETED;
    } else if (paidAmount.gt(0)) {
      status = PaymentPlanStatus.PARTIAL;
    }

    await tx.paymentPlan.update({
      where: { id: planId },
      data: { status },
    });
  }

  /**
   * 获取回款统计数据
   */
  async getStatistics() {
    const salesContractTypeCodes = await this.getSalesContractTypeCodes();
    const salesContractTypeSet = new Set(
      salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
    );

    // 仅读取销售合同，避免其他类型合同混入回款看板
    const contracts = await this.prisma.contract.findMany({
      where: {
        isDeleted: false,
        status: ContractStatus.EXECUTING,
        OR: [
          {
            contractType: {
              in: salesContractTypeCodes,
            },
          },
          {
            contractType: {
              contains: "销售",
            },
          },
          {
            contractType: {
              contains: "SALE",
              mode: "insensitive",
            },
          },
        ],
      },
      include: {
        customer: {
          select: { id: true, name: true, code: true },
        },
        paymentPlans: {
          include: {
            paymentRecords: true,
          },
        },
        paymentRecords: true,
      },
    });

    const salesContracts = contracts.filter((contract) =>
      this.resolveIsSalesContractType(
        contract.contractType,
        salesContractTypeSet,
      ),
    );

    // 计算统计数据
    let totalContractAmount = new Decimal(0);
    let totalPaidAmount = new Decimal(0);
    let totalReceivable = new Decimal(0);
    let overdueAmount = new Decimal(0);
    const today = new Date();

    const contractStats = salesContracts.map((contract) => {
      const contractAmount = new Decimal(contract.amountWithTax.toString());
      const paidAmount = contract.paymentRecords.reduce(
        (sum, record) => sum.plus(record.amount),
        new Decimal(0),
      );
      const receivable = contractAmount.minus(paidAmount);

      totalContractAmount = totalContractAmount.plus(contractAmount);
      totalPaidAmount = totalPaidAmount.plus(paidAmount);
      totalReceivable = totalReceivable.plus(receivable);

      // 计算逾期金额（计划日期已过但未完成的回款计划）
      let contractOverdue = new Decimal(0);
      contract.paymentPlans.forEach((plan) => {
        if (
          plan.status !== PaymentPlanStatus.COMPLETED &&
          new Date(plan.planDate) < today
        ) {
          const planPaid = plan.paymentRecords.reduce(
            (sum, r) => sum.plus(r.amount),
            new Decimal(0),
          );
          contractOverdue = contractOverdue.plus(
            new Decimal(plan.planAmount.toString()).minus(planPaid),
          );
        }
      });
      overdueAmount = overdueAmount.plus(contractOverdue);

      return {
        id: contract.id,
        contractNo: contract.contractNo,
        name: contract.name,
        customer: contract.customer,
        amountWithTax: contractAmount,
        totalPaid: paidAmount,
        receivable,
        overdueAmount: contractOverdue,
        progress: contractAmount.gt(0)
          ? Math.round(paidAmount.div(contractAmount).mul(100).toNumber())
          : 0,
        signDate: contract.signDate,
        status: contract.status,
      };
    });

    return {
      summary: {
        totalContractAmount,
        totalPaidAmount,
        totalReceivable,
        overdueAmount,
        contractCount: salesContracts.length,
        completionRate: totalContractAmount.gt(0)
          ? Math.round(
              totalPaidAmount.div(totalContractAmount).mul(100).toNumber(),
            )
          : 0,
      },
      contracts: contractStats,
    };
  }

  private resolveIsSalesContractType(
    contractType: string | null | undefined,
    salesCodes: Set<string>,
  ): boolean {
    const normalized = normalizeText(contractType || "").toUpperCase();
    if (!normalized) return false;
    if (salesCodes.has(normalized)) return true;
    return isSalesContractType([contractType || ""]);
  }

  /**
   * 获取合同的回款计划列表
   */
  async findPlansByContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
      select: { id: true, contractType: true },
    });
    if (!contract) {
      throw new NotFoundException("合同不存在");
    }
    await this.assertSalesContract(contract.contractType);

    const plans = await this.prisma.paymentPlan.findMany({
      where: { contractId },
      orderBy: { period: "asc" },
      include: {
        paymentRecords: true,
      },
    });

    // 计算每期的已回款金额
    return plans.map((plan) => {
      const paidAmount = plan.paymentRecords.reduce(
        (sum, record) => sum.plus(record.amount),
        new Decimal(0),
      );
      return {
        ...plan,
        paidAmount,
        remainingAmount: new Decimal(plan.planAmount.toString()).minus(
          paidAmount,
        ),
      };
    });
  }

  /**
   * 获取合同的回款记录列表
   */
  async findRecordsByContract(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
      select: { id: true, contractType: true },
    });
    if (!contract) {
      throw new NotFoundException("合同不存在");
    }
    await this.assertSalesContract(contract.contractType);

    return this.prisma.paymentRecord.findMany({
      where: { contractId },
      orderBy: { paymentDate: "desc" },
      include: {
        plan: true,
      },
    });
  }

  /**
   * 创建回款计划
   */
  async createPlan(createPlanDto: CreatePaymentPlanDto) {
    const { contractId, period, planAmount, planDate } = createPlanDto;

    // 验证合同
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException("合同不存在");
    }
    await this.assertSalesContract(contract.contractType);

    // 检查期数是否重复
    const existingPlan = await this.prisma.paymentPlan.findFirst({
      where: { contractId, period },
    });
    if (existingPlan) {
      throw new BadRequestException(`第${period}期回款计划已存在`);
    }

    // 检查计划总金额是否超出合同金额
    const existingPlans = await this.prisma.paymentPlan.aggregate({
      where: { contractId },
      _sum: { planAmount: true },
    });
    const totalPlanAmount = (
      existingPlans._sum.planAmount || new Decimal(0)
    ).plus(planAmount);
    if (totalPlanAmount.gt(contract.amountWithTax)) {
      throw new BadRequestException("回款计划总金额不能超过合同金额");
    }

    return this.prisma.paymentPlan.create({
      data: {
        contractId,
        period,
        planAmount,
        planDate: new Date(planDate),
      },
    });
  }

  /**
   * 批量创建回款计划
   */
  async createPlans(contractId: string, plans: CreatePaymentPlanDto[]) {
    // 验证合同
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException("合同不存在");
    }
    await this.assertSalesContract(contract.contractType);

    // 检查计划总金额
    const totalPlanAmount = plans.reduce(
      (sum, plan) => sum.plus(plan.planAmount),
      new Decimal(0),
    );
    if (totalPlanAmount.gt(contract.amountWithTax)) {
      throw new BadRequestException("回款计划总金额不能超过合同金额");
    }

    // 删除现有计划
    await this.prisma.paymentPlan.deleteMany({
      where: { contractId },
    });

    // 创建新计划
    return this.prisma.paymentPlan.createMany({
      data: plans.map((plan) => ({
        contractId,
        period: plan.period,
        planAmount: plan.planAmount,
        planDate: new Date(plan.planDate),
      })),
    });
  }

  /**
   * 创建回款记录
   */
  async createRecord(createRecordDto: CreatePaymentRecordDto) {
    const { contractId, planId, amount, paymentDate, paymentMethod, remark } =
      createRecordDto;

    // 验证合同
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException("合同不存在");
    }
    await this.assertSalesContract(contract.contractType);

    // 合同必须是执行中状态
    if (contract.status !== ContractStatus.EXECUTING) {
      throw new BadRequestException("只有执行中的合同可以录入回款");
    }

    // 验证回款计划（如果有），并确认与合同匹配
    if (planId) {
      const plan = await this.prisma.paymentPlan.findUnique({
        where: { id: planId },
        select: { id: true, contractId: true },
      });
      if (!plan) {
        throw new NotFoundException("回款计划不存在");
      }
      if (plan.contractId !== contractId) {
        throw new BadRequestException("回款计划与合同不匹配");
      }
    }

    // 检查回款金额是否超出应收
    const totalPaid = await this.prisma.paymentRecord.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });
    const paidAmount = totalPaid._sum.amount || new Decimal(0);
    const newTotalPaid = paidAmount.plus(amount);

    if (newTotalPaid.gt(contract.amountWithTax)) {
      throw new BadRequestException("回款金额超出应收余额");
    }

    // 使用事务创建回款记录并更新相关状态
    const result = await this.prisma.$transaction(async (tx) => {
      // 创建回款记录
      const record = await tx.paymentRecord.create({
        data: {
          contractId,
          planId,
          amount,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          remark,
        },
      });

      // 如果关联了回款计划，更新计划状态
      if (planId) {
        await this.refreshPlanStatus(tx, planId);
      }

      return record;
    });

    // 检查是否需要自动完成合同
    await this.contractsService.reconcileContractStatus(contractId);

    return result;
  }

  /**
   * 删除回款计划
   */
  async removePlan(id: string) {
    const plan = await this.prisma.paymentPlan.findUnique({
      where: { id },
      include: { paymentRecords: true },
    });

    if (!plan) {
      throw new NotFoundException("回款计划不存在");
    }

    if (plan.paymentRecords.length > 0) {
      throw new BadRequestException("该计划已有回款记录，无法删除");
    }

    return this.prisma.paymentPlan.delete({
      where: { id },
    });
  }

  /**
   * 删除回款记录
   */
  async removeRecord(id: string) {
    const record = await this.prisma.paymentRecord.findUnique({
      where: { id },
      select: { id: true, contractId: true, planId: true },
    });

    if (!record) {
      throw new NotFoundException("回款记录不存在");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentRecord.delete({
        where: { id },
      });

      if (record.planId) {
        await this.refreshPlanStatus(tx, record.planId);
      }
    });

    await this.contractsService.reconcileContractStatus(record.contractId);
    return { message: "回款记录删除成功" };
  }
}
