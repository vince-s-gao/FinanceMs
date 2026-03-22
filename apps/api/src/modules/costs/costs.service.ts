// InfFinanceMs - 费用服务

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCostDto } from "./dto/create-cost.dto";
import { QueryCostDto } from "./dto/query-cost.dto";
import {
  parseDateRangeEnd,
  parseDateRangeStart,
  resolveSortField,
} from "../../common/utils/query.utils";
import { COST_SOURCE, ERROR_CODE } from "@inffinancems/shared";
import type { Prisma } from "@prisma/client";

const ALLOWED_COST_SORT_FIELDS = [
  "feeType",
  "amount",
  "occurDate",
  "source",
  "createdAt",
  "updatedAt",
] as const;

@Injectable()
export class CostsService {
  constructor(private prisma: PrismaService) {}

  private badRequest(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private notFound(code: string, message: string): never {
    throw new NotFoundException({ code, message });
  }

  /**
   * 获取费用列表
   */
  async findAll(query: QueryCostDto) {
    const {
      page = 1,
      pageSize = 20,
      feeType,
      source,
      projectId,
      contractId,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(
      sortBy,
      ALLOWED_COST_SORT_FIELDS,
      "createdAt",
    );

    const where: Prisma.CostWhereInput = {};

    // 费用类型筛选
    if (feeType) {
      where.feeType = feeType;
    }

    // 来源筛选
    if (source) {
      where.source = source;
    }

    // 项目筛选
    if (projectId) {
      where.projectId = projectId;
    }

    // 合同筛选
    if (contractId) {
      where.contractId = contractId;
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.occurDate = {};
      if (startDate) where.occurDate.gte = parseDateRangeStart(startDate);
      if (endDate) where.occurDate.lte = parseDateRangeEnd(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.cost.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          project: {
            select: { id: true, code: true, name: true },
          },
          contract: {
            select: { id: true, contractNo: true, name: true },
          },
          expense: {
            select: { id: true, expenseNo: true },
          },
        },
      }),
      this.prisma.cost.count({ where }),
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
   * 获取费用详情
   */
  async findOne(id: string) {
    const cost = await this.prisma.cost.findUnique({
      where: { id },
      include: {
        contract: true,
        expense: {
          include: {
            applicant: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!cost) {
      this.notFound(ERROR_CODE.COST_NOT_FOUND, "费用不存在");
    }

    return cost;
  }

  /**
   * 创建费用（直接录入）
   */
  async create(createCostDto: CreateCostDto) {
    const { projectId, feeType, amount, occurDate, contractId, description } =
      createCostDto;

    // 使用事务保证校验与创建在同一原子操作中，避免并发下出现读写不一致。
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const project = await tx.project.findFirst({
        where: { id: projectId, isDeleted: false },
      });
      if (!project) {
        this.badRequest(ERROR_CODE.COST_PROJECT_NOT_FOUND, "关联项目不存在");
      }

      if (contractId) {
        const contract = await tx.contract.findFirst({
          where: { id: contractId, isDeleted: false },
        });
        if (!contract) {
          this.badRequest(ERROR_CODE.COST_CONTRACT_NOT_FOUND, "关联合同不存在");
        }
      }

      return tx.cost.create({
        data: {
          feeType,
          amount,
          occurDate: new Date(occurDate),
          source: COST_SOURCE.DIRECT,
          projectId,
          contractId,
          description,
        },
        include: {
          project: {
            select: { id: true, code: true, name: true },
          },
          contract: {
            select: { id: true, contractNo: true, name: true },
          },
        },
      });
    });
  }

  /**
   * 删除费用
   */
  async remove(id: string) {
    const cost = await this.findOne(id);

    // 报销生成的费用不能直接删除
    if (cost.source === COST_SOURCE.REIMBURSEMENT) {
      this.badRequest(
        ERROR_CODE.COST_DELETE_REIMBURSEMENT_FORBIDDEN,
        "报销生成的费用不能直接删除",
      );
    }

    return this.prisma.cost.delete({
      where: { id },
    });
  }

  /**
   * 获取合同相关费用汇总
   */
  async getContractCostSummary(contractId: string) {
    const costs = await this.prisma.cost.groupBy({
      by: ["feeType"],
      where: { contractId },
      _sum: { amount: true },
    });

    const total = await this.prisma.cost.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });

    return {
      byType: costs.map((c) => ({
        feeType: c.feeType,
        amount: c._sum.amount,
      })),
      total: total._sum.amount || 0,
    };
  }
}
