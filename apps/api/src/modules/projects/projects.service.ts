// InfFinanceMs - 项目服务

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { QueryProjectDto } from "./dto/query-project.dto";
import { resolveSortField } from "../../common/utils/query.utils";
import {
  createWithGeneratedCode,
  generatePrefixedCode,
} from "../../common/utils/code-generator.utils";
import { isUniqueConflict as isPrismaUniqueConflict } from "../../common/utils/prisma.utils";

const ALLOWED_PROJECT_SORT_FIELDS = [
  "code",
  "name",
  "status",
  "startDate",
  "endDate",
  "createdAt",
  "updatedAt",
] as const;

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成项目编号
   * 规则：TKFY + 年份(4位) + 顺序号(4位)
   * 例如：TKFY20250001
   */
  private async generateProjectCode(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `TKFY${currentYear}`;
    return generatePrefixedCode({
      model: this.prisma.project,
      field: "code",
      prefix,
      sequenceRegex: /^TKFY\d{4}(\d{4})$/,
      sequenceLength: 4,
    });
  }

  private isProjectCodeConflict(error: unknown): boolean {
    return isPrismaUniqueConflict(error, "code");
  }

  /**
   * 获取项目列表
   */
  async findAll(query: QueryProjectDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(
      sortBy,
      ALLOWED_PROJECT_SORT_FIELDS,
      "createdAt",
    );

    const where: any = {
      isDeleted: false,
    };

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: "insensitive" } },
        { name: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
      }),
      this.prisma.project.count({ where }),
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
   * 获取项目详情
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, isDeleted: false },
      include: {
        expenses: {
          select: {
            id: true,
            expenseNo: true,
            totalAmount: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!project) {
      throw new NotFoundException("项目不存在");
    }

    return project;
  }

  /**
   * 创建项目
   */
  async create(createDto: CreateProjectDto) {
    // 移除 createDto 中的 code 字段，使用系统生成的编号
    const { code: _, ...restDto } = createDto as any;

    return createWithGeneratedCode({
      generateCode: () => this.generateProjectCode(),
      create: (code: string) =>
        this.prisma.project.create({
          data: {
            ...restDto,
            code,
            startDate: createDto.startDate
              ? new Date(createDto.startDate)
              : undefined,
            endDate: createDto.endDate
              ? new Date(createDto.endDate)
              : undefined,
          },
        }),
      isCodeConflict: (error) => this.isProjectCodeConflict(error),
      exhaustedError: () => new ConflictException("项目编号生成失败，请重试"),
    });
  }

  /**
   * 更新项目
   */
  async update(id: string, updateDto: UpdateProjectDto) {
    await this.findOne(id);

    // 项目编号不允许修改，移除 code 字段
    const { code: _, ...restDto } = updateDto as any;

    return this.prisma.project.update({
      where: { id },
      data: {
        ...restDto,
        startDate: updateDto.startDate
          ? new Date(updateDto.startDate)
          : undefined,
        endDate: updateDto.endDate ? new Date(updateDto.endDate) : undefined,
      },
    });
  }

  /**
   * 删除项目（软删除）
   */
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.project.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
