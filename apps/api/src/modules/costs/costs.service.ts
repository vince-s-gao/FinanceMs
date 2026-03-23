// InfFinanceMs - 费用服务

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  COST_SOURCE,
  COST_SOURCE_LABELS,
  ERROR_CODE,
  FEE_TYPE_LABELS,
  FEE_TYPES,
} from "@inffinancems/shared";
import { PrismaService } from "../../prisma/prisma.service";
import {
  normalizePagination,
  parseDateRangeEnd,
  parseDateRangeStart,
  resolveSortField,
} from "../../common/utils/query.utils";
import {
  normalizeText,
  parseTabularBuffer,
  resolveHeaderIndex,
  toCsv,
  toXlsxBuffer,
} from "../../common/utils/tabular.utils";
import { CreateCostDto } from "./dto/create-cost.dto";
import { QueryCostDto } from "./dto/query-cost.dto";
import { UpdateCostDto } from "./dto/update-cost.dto";

const ALLOWED_COST_SORT_FIELDS = [
  "feeType",
  "amount",
  "occurDate",
  "source",
  "createdAt",
  "updatedAt",
] as const;

const COST_IMPORT_HEADER_ALIASES = {
  feeType: ["费用类型", "费用类别", "feetype", "fee_type"],
  amount: ["金额", "费用金额", "amount"],
  occurDate: ["发生日期", "日期", "occurdate", "occur_date", "date"],
  project: [
    "项目",
    "项目编号",
    "项目名称",
    "project",
    "projectcode",
    "projectname",
  ],
  contract: [
    "合同",
    "合同编号",
    "合同名称",
    "contract",
    "contractno",
    "contractname",
  ],
  description: ["说明", "备注", "description", "remark"],
} as const;

@Injectable()
export class CostsService {
  constructor(private prisma: PrismaService) {}

  private badRequest(code: string, message: string): never {
    throw new BadRequestException({ code, message });
  }

  private notFound(code: string, message: string): never {
    throw new NotFoundException({ code, message });
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (typeof value === "object" && value !== null && "toNumber" in value) {
      const maybe = (value as { toNumber?: () => number }).toNumber?.();
      return typeof maybe === "number" && Number.isFinite(maybe) ? maybe : 0;
    }
    return 0;
  }

  private buildWhere(query: QueryCostDto): Prisma.CostWhereInput {
    const {
      keyword,
      feeType,
      source,
      projectId,
      contractId,
      startDate,
      endDate,
    } = query;

    const where: Prisma.CostWhereInput = {};

    if (feeType) {
      where.feeType = feeType;
    }

    if (source) {
      where.source = source;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (contractId) {
      where.contractId = contractId;
    }

    if (startDate || endDate) {
      where.occurDate = {};
      if (startDate) where.occurDate.gte = parseDateRangeStart(startDate);
      if (endDate) where.occurDate.lte = parseDateRangeEnd(endDate);
    }

    if (keyword?.trim()) {
      const text = keyword.trim();
      where.OR = [
        { description: { contains: text, mode: "insensitive" } },
        {
          project: {
            is: {
              OR: [
                { code: { contains: text, mode: "insensitive" } },
                { name: { contains: text, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          contract: {
            is: {
              OR: [
                { contractNo: { contains: text, mode: "insensitive" } },
                { name: { contains: text, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          expense: {
            is: {
              expenseNo: { contains: text, mode: "insensitive" },
            },
          },
        },
      ];
    }

    return where;
  }

  /**
   * 获取费用列表
   */
  async findAll(query: QueryCostDto) {
    const {
      page = 1,
      pageSize = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
    const {
      page: safePage,
      pageSize: safePageSize,
      skip,
    } = normalizePagination({ page, pageSize });
    const safeSortBy = resolveSortField(
      sortBy,
      ALLOWED_COST_SORT_FIELDS,
      "createdAt",
    );
    const where = this.buildWhere(query);

    const [items, total] = await Promise.all([
      this.prisma.cost.findMany({
        where,
        skip,
        take: safePageSize,
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
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  /**
   * 费用汇总看板
   */
  async getSummary(query: QueryCostDto) {
    const where = this.buildWhere(query);
    const directWhere: Prisma.CostWhereInput = {
      AND: [where, { source: COST_SOURCE.DIRECT }],
    };
    const reimbursementWhere: Prisma.CostWhereInput = {
      AND: [where, { source: COST_SOURCE.REIMBURSEMENT }],
    };
    const withContractWhere: Prisma.CostWhereInput = {
      AND: [where, { contractId: { not: null } }],
    };

    const [
      overall,
      direct,
      reimbursement,
      byFeeType,
      groupedProjects,
      groupedContracts,
    ] = await Promise.all([
      this.prisma.cost.aggregate({
        where,
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.cost.aggregate({
        where: directWhere,
        _sum: { amount: true },
      }),
      this.prisma.cost.aggregate({
        where: reimbursementWhere,
        _sum: { amount: true },
      }),
      this.prisma.cost.groupBy({
        by: ["feeType"],
        where,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: {
          _sum: {
            amount: "desc",
          },
        },
      }),
      this.prisma.cost.groupBy({
        by: ["projectId"],
        where,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: {
          _sum: {
            amount: "desc",
          },
        },
        take: 5,
      }),
      this.prisma.cost.groupBy({
        by: ["contractId"],
        where: withContractWhere,
        _sum: { amount: true },
        _count: { _all: true },
        orderBy: {
          _sum: {
            amount: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const projectIds = groupedProjects.map((item) => item.projectId);
    const contractIds = groupedContracts
      .map((item) => item.contractId)
      .filter((value): value is string => !!value);

    const [projects, contracts] = await Promise.all([
      projectIds.length
        ? this.prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, code: true, name: true },
          })
        : Promise.resolve(
            [] as Array<{ id: string; code: string; name: string }>,
          ),
      contractIds.length
        ? this.prisma.contract.findMany({
            where: { id: { in: contractIds } },
            select: { id: true, contractNo: true, name: true },
          })
        : Promise.resolve(
            [] as Array<{ id: string; contractNo: string; name: string }>,
          ),
    ]);

    const projectMap = new Map<
      string,
      { id: string; code: string; name: string }
    >(projects.map((item) => [item.id, item] as const));
    const contractMap = new Map<
      string,
      { id: string; contractNo: string; name: string }
    >(contracts.map((item) => [item.id, item] as const));

    return {
      totalAmount: this.toNumber(overall._sum.amount),
      totalCount: overall._count._all || 0,
      directAmount: this.toNumber(direct._sum.amount),
      reimbursementAmount: this.toNumber(reimbursement._sum.amount),
      byFeeType: byFeeType.map((item) => ({
        feeType: item.feeType,
        feeTypeLabel: FEE_TYPE_LABELS[item.feeType] || item.feeType,
        amount: this.toNumber(item._sum.amount),
        count: item._count._all || 0,
      })),
      topProjects: groupedProjects.map((item) => {
        const project = projectMap.get(item.projectId);
        return {
          projectId: item.projectId,
          projectCode: project?.code || "-",
          projectName: project?.name || "-",
          amount: this.toNumber(item._sum.amount),
          count: item._count._all || 0,
        };
      }),
      topContracts: groupedContracts.map((item) => {
        const contract = item.contractId
          ? contractMap.get(item.contractId)
          : null;
        return {
          contractId: item.contractId,
          contractNo: contract?.contractNo || "-",
          contractName: contract?.name || "-",
          amount: this.toNumber(item._sum.amount),
          count: item._count._all || 0,
        };
      }),
    };
  }

  /**
   * 获取费用详情
   */
  async findOne(id: string) {
    const cost = await this.prisma.cost.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        contract: {
          select: { id: true, contractNo: true, name: true },
        },
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
   * 更新费用（仅直接录入）
   */
  async update(id: string, updateCostDto: UpdateCostDto) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.cost.findUnique({
        where: { id },
        select: { id: true, source: true },
      });
      if (!existing) {
        this.notFound(ERROR_CODE.COST_NOT_FOUND, "费用不存在");
      }
      if (existing.source !== COST_SOURCE.DIRECT) {
        this.badRequest(
          ERROR_CODE.COST_DELETE_REIMBURSEMENT_FORBIDDEN,
          "报销生成的费用不允许编辑",
        );
      }

      const data: Prisma.CostUpdateInput = {};
      if (updateCostDto.feeType !== undefined)
        data.feeType = updateCostDto.feeType;
      if (updateCostDto.amount !== undefined)
        data.amount = updateCostDto.amount;
      if (updateCostDto.occurDate !== undefined) {
        data.occurDate = new Date(updateCostDto.occurDate);
      }
      if (updateCostDto.description !== undefined) {
        data.description = updateCostDto.description || null;
      }

      if (updateCostDto.projectId !== undefined) {
        const project = await tx.project.findFirst({
          where: { id: updateCostDto.projectId, isDeleted: false },
        });
        if (!project) {
          this.badRequest(ERROR_CODE.COST_PROJECT_NOT_FOUND, "关联项目不存在");
        }
        data.project = { connect: { id: updateCostDto.projectId } };
      }

      if (updateCostDto.contractId !== undefined) {
        if (updateCostDto.contractId) {
          const contract = await tx.contract.findFirst({
            where: { id: updateCostDto.contractId, isDeleted: false },
          });
          if (!contract) {
            this.badRequest(
              ERROR_CODE.COST_CONTRACT_NOT_FOUND,
              "关联合同不存在",
            );
          }
          data.contract = { connect: { id: updateCostDto.contractId } };
        } else {
          data.contract = { disconnect: true };
        }
      }

      return tx.cost.update({
        where: { id },
        data,
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
      });
    });
  }

  private async buildExportPayload(query: QueryCostDto) {
    const where = this.buildWhere(query);
    const items = await this.prisma.cost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        project: {
          select: { code: true, name: true },
        },
        contract: {
          select: { contractNo: true, name: true },
        },
        expense: {
          select: { expenseNo: true },
        },
      },
    });

    const headers = [
      "费用类型",
      "金额",
      "发生日期",
      "来源",
      "项目编号",
      "项目名称",
      "合同编号",
      "合同名称",
      "报销单号",
      "说明",
      "创建时间",
    ];
    const rows = items.map((item) => [
      FEE_TYPE_LABELS[item.feeType] || item.feeType,
      this.toNumber(item.amount),
      item.occurDate.toISOString().slice(0, 10),
      COST_SOURCE_LABELS[item.source] || item.source,
      item.project?.code || "",
      item.project?.name || "",
      item.contract?.contractNo || "",
      item.contract?.name || "",
      item.expense?.expenseNo || "",
      item.description || "",
      item.createdAt.toISOString().slice(0, 19).replace("T", " "),
    ]);

    return { headers, rows };
  }

  async exportCsv(query: QueryCostDto) {
    const { headers, rows } = await this.buildExportPayload(query);
    return toCsv(headers, rows);
  }

  async exportExcel(query: QueryCostDto): Promise<Buffer> {
    const { headers, rows } = await this.buildExportPayload(query);
    return toXlsxBuffer(headers, rows);
  }

  private resolveFeeType(raw: string): (typeof FEE_TYPES)[number] | null {
    const value = normalizeText(raw);
    if (!value) return null;
    const upper = value.toUpperCase();
    if (FEE_TYPES.includes(upper as (typeof FEE_TYPES)[number])) {
      return upper as (typeof FEE_TYPES)[number];
    }
    const match = Object.entries(FEE_TYPE_LABELS).find(
      ([, label]) => label === value,
    );
    return (match?.[0] as (typeof FEE_TYPES)[number]) || null;
  }

  private parseImportDate(raw: string): Date | null {
    const value = normalizeText(raw);
    if (!value) return null;

    if (/^\d{4,6}(\.\d+)?$/.test(value)) {
      const serial = Number(value);
      if (Number.isFinite(serial) && serial > 0) {
        const excelBase = new Date(Date.UTC(1899, 11, 30));
        const ms = Math.round(serial * 24 * 60 * 60 * 1000);
        const parsed = new Date(excelBase.getTime() + ms);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  private async resolveProjectId(
    raw: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const value = normalizeText(raw);
    if (!value) {
      throw new BadRequestException("项目不能为空");
    }
    if (cache.has(value)) {
      return cache.get(value) as string;
    }

    const byId = await this.prisma.project.findFirst({
      where: { id: value, isDeleted: false },
      select: { id: true },
    });
    if (byId) {
      cache.set(value, byId.id);
      return byId.id;
    }

    const byCode = await this.prisma.project.findFirst({
      where: { code: value, isDeleted: false },
      select: { id: true },
    });
    if (byCode) {
      cache.set(value, byCode.id);
      return byCode.id;
    }

    const byName = await this.prisma.project.findMany({
      where: { name: value, isDeleted: false },
      select: { id: true },
      take: 2,
    });
    if (byName.length === 1) {
      cache.set(value, byName[0].id);
      return byName[0].id;
    }
    if (byName.length > 1) {
      throw new BadRequestException(`项目名称不唯一: ${value}`);
    }

    throw new BadRequestException(`未找到项目: ${value}`);
  }

  private async resolveContractId(
    raw: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const value = normalizeText(raw);
    if (!value) {
      throw new BadRequestException("关联合同为空");
    }
    if (cache.has(value)) {
      return cache.get(value) as string;
    }

    const byId = await this.prisma.contract.findFirst({
      where: { id: value, isDeleted: false },
      select: { id: true },
    });
    if (byId) {
      cache.set(value, byId.id);
      return byId.id;
    }

    const byNo = await this.prisma.contract.findFirst({
      where: { contractNo: value, isDeleted: false },
      select: { id: true },
    });
    if (byNo) {
      cache.set(value, byNo.id);
      return byNo.id;
    }

    const byName = await this.prisma.contract.findMany({
      where: { name: value, isDeleted: false },
      select: { id: true },
      take: 2,
    });
    if (byName.length === 1) {
      cache.set(value, byName[0].id);
      return byName[0].id;
    }
    if (byName.length > 1) {
      throw new BadRequestException(`合同名称不唯一: ${value}`);
    }

    throw new BadRequestException(`未找到合同: ${value}`);
  }

  async importFile(fileBuffer: Buffer, fileName: string) {
    const rows = parseTabularBuffer(fileBuffer, fileName);
    if (rows.length <= 1) {
      return {
        total: 0,
        success: 0,
        failed: 0,
        errors: [] as Array<{ row: number; message: string }>,
      };
    }

    const header = rows[0];
    const feeTypeIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.feeType,
    );
    const amountIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.amount,
    );
    const occurDateIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.occurDate,
    );
    const projectIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.project,
    );
    const contractIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.contract,
    );
    const descriptionIdx = resolveHeaderIndex(
      header,
      COST_IMPORT_HEADER_ALIASES.description,
    );

    const missing: string[] = [];
    if (feeTypeIdx === undefined) missing.push("费用类型");
    if (amountIdx === undefined) missing.push("金额");
    if (occurDateIdx === undefined) missing.push("发生日期");
    if (projectIdx === undefined) missing.push("项目");
    if (missing.length > 0) {
      throw new BadRequestException(`导入文件缺少字段: ${missing.join("、")}`);
    }

    const errors: Array<{ row: number; message: string }> = [];
    const projectCache = new Map<string, string>();
    const contractCache = new Map<string, string>();
    let total = 0;
    let success = 0;

    const getCell = (row: string[], idx?: number): string => {
      if (idx === undefined) return "";
      return normalizeText(String(row[idx] || ""));
    };

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.every((cell) => !normalizeText(String(cell)))) continue;
      total += 1;
      const rowNo = i + 1;

      try {
        const feeTypeRaw = getCell(row, feeTypeIdx);
        const amountRaw = getCell(row, amountIdx);
        const occurDateRaw = getCell(row, occurDateIdx);
        const projectRaw = getCell(row, projectIdx);
        const contractRaw = getCell(row, contractIdx);
        const descriptionRaw = getCell(row, descriptionIdx);

        const feeType = this.resolveFeeType(feeTypeRaw);
        if (!feeType) {
          throw new BadRequestException(
            `费用类型无效: ${feeTypeRaw || "(空)"}`,
          );
        }

        const amount = Number(amountRaw.replace(/[,，\s]/g, ""));
        if (!Number.isFinite(amount) || amount < 0.01) {
          throw new BadRequestException("金额必须大于等于 0.01");
        }

        const occurDate = this.parseImportDate(occurDateRaw);
        if (!occurDate) {
          throw new BadRequestException(
            `发生日期格式无效: ${occurDateRaw || "(空)"}`,
          );
        }

        const projectId = await this.resolveProjectId(projectRaw, projectCache);
        const contractId = contractRaw
          ? await this.resolveContractId(contractRaw, contractCache)
          : null;

        await this.prisma.cost.create({
          data: {
            feeType,
            amount,
            occurDate,
            source: COST_SOURCE.DIRECT,
            projectId,
            contractId,
            description: descriptionRaw || null,
          },
        });
        success += 1;
      } catch (error: unknown) {
        const msg =
          (error as { response?: { message?: string }; message?: string })
            ?.response?.message ||
          (error as { message?: string })?.message ||
          "导入失败";
        errors.push({ row: rowNo, message: String(msg) });
      }
    }

    return {
      total,
      success,
      failed: total - success,
      errors,
    };
  }

  /**
   * 删除费用
   */
  async remove(id: string) {
    const cost = await this.findOne(id);

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
        amount: this.toNumber(c._sum.amount),
      })),
      total: this.toNumber(total._sum.amount),
    };
  }
}
