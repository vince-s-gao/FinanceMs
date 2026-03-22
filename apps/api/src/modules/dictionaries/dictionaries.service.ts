// InfFinanceMs - 数据字典服务

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateDictionaryDto } from "./dto/create-dictionary.dto";
import { UpdateDictionaryDto } from "./dto/update-dictionary.dto";
import { QueryDictionaryDto } from "./dto/query-dictionary.dto";

type DictionaryOption = {
  id: string;
  code: string;
  name: string;
  value: string | null;
  color: string | null;
  isDefault: boolean;
};

@Injectable()
export class DictionariesService {
  private readonly byTypeCache = new Map<
    string,
    { expiresAt: number; items: DictionaryOption[] }
  >();
  private readonly byTypeCacheTtlMs = 5 * 60 * 1000;

  constructor(private prisma: PrismaService) {}

  private toTypeCacheKey(type: string): string {
    return String(type || "")
      .trim()
      .toUpperCase();
  }

  private getByTypeCache(type: string): DictionaryOption[] | null {
    const key = this.toTypeCacheKey(type);
    const entry = this.byTypeCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.byTypeCache.delete(key);
      return null;
    }
    return entry.items;
  }

  private setByTypeCache(type: string, items: DictionaryOption[]) {
    const key = this.toTypeCacheKey(type);
    this.byTypeCache.set(key, {
      expiresAt: Date.now() + this.byTypeCacheTtlMs,
      items,
    });
  }

  private invalidateByTypeCache(type?: string) {
    if (!type) {
      this.byTypeCache.clear();
      return;
    }
    this.byTypeCache.delete(this.toTypeCacheKey(type));
  }

  /**
   * 获取字典列表
   */
  async findAll(query: QueryDictionaryDto) {
    const { type, isEnabled } = query;

    const where: any = {};

    if (type) {
      where.type = type;
    }

    if (isEnabled !== undefined) {
      where.isEnabled = isEnabled;
    }

    return this.prisma.dictionary.findMany({
      where,
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    });
  }

  /**
   * 根据类型获取字典列表（用于下拉选择）
   */
  async findByType(type: string) {
    const cached = this.getByTypeCache(type);
    if (cached) return cached;

    const items = await this.prisma.dictionary.findMany({
      where: {
        type,
        isEnabled: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        value: true,
        color: true,
        isDefault: true,
      },
    });
    this.setByTypeCache(type, items);
    return items;
  }

  /**
   * 获取字典详情
   */
  async findOne(id: string) {
    const dictionary = await this.prisma.dictionary.findUnique({
      where: { id },
    });

    if (!dictionary) {
      throw new NotFoundException("字典项不存在");
    }

    return dictionary;
  }

  /**
   * 创建字典项
   */
  async create(createDto: CreateDictionaryDto) {
    // 检查同类型下编码是否重复
    const existing = await this.prisma.dictionary.findUnique({
      where: {
        type_code: {
          type: createDto.type,
          code: createDto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException("该类型下已存在相同编码的字典项");
    }

    // 如果设置为默认值，取消同类型其他默认值
    if (createDto.isDefault) {
      await this.prisma.dictionary.updateMany({
        where: { type: createDto.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.dictionary.create({
      data: createDto,
    });
    this.invalidateByTypeCache(createDto.type);
    return created;
  }

  /**
   * 更新字典项
   */
  async update(id: string, updateDto: UpdateDictionaryDto) {
    const dictionary = await this.findOne(id);

    // 如果修改了编码，检查是否重复
    if (updateDto.code && updateDto.code !== dictionary.code) {
      const existing = await this.prisma.dictionary.findUnique({
        where: {
          type_code: {
            type: updateDto.type || dictionary.type,
            code: updateDto.code,
          },
        },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException("该类型下已存在相同编码的字典项");
      }
    }

    // 如果设置为默认值，取消同类型其他默认值
    if (updateDto.isDefault) {
      await this.prisma.dictionary.updateMany({
        where: {
          type: updateDto.type || dictionary.type,
          isDefault: true,
          NOT: { id },
        },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.dictionary.update({
      where: { id },
      data: updateDto,
    });
    const targetType = updateDto.type || dictionary.type;
    this.invalidateByTypeCache(dictionary.type);
    if (targetType !== dictionary.type) {
      this.invalidateByTypeCache(targetType);
    }
    return updated;
  }

  /**
   * 删除字典项
   */
  async remove(id: string) {
    const dictionary = await this.findOne(id);
    const removed = await this.prisma.dictionary.delete({
      where: { id },
    });
    this.invalidateByTypeCache(dictionary.type);
    return removed;
  }

  /**
   * 批量创建字典项（用于初始化）
   */
  async batchCreate(items: CreateDictionaryDto[]) {
    const results = [];
    for (const item of items) {
      try {
        const result = await this.create(item);
        results.push(result);
      } catch (error) {
        // 忽略重复错误，继续创建其他项
        if (!(error instanceof ConflictException)) {
          throw error;
        }
      }
    }
    return results;
  }

  /**
   * 获取所有字典类型
   */
  async getTypes() {
    const types = await this.prisma.dictionary.findMany({
      select: { type: true },
      distinct: ["type"],
      orderBy: { type: "asc" },
    });

    return types.map((t) => t.type);
  }

  /**
   * 初始化默认客户类型
   */
  async initCustomerTypes() {
    const defaultTypes = [
      {
        type: "CUSTOMER_TYPE",
        code: "ENTERPRISE",
        name: "企业",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "CUSTOMER_TYPE",
        code: "INDIVIDUAL",
        name: "个人",
        color: "green",
        sortOrder: 2,
      },
    ];

    return this.batchCreate(defaultTypes);
  }

  /**
   * 初始化默认报销类型
   */
  async initExpenseTypes() {
    const defaultTypes = [
      {
        type: "EXPENSE_TYPE",
        code: "TRAVEL",
        name: "差旅费",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "EXPENSE_TYPE",
        code: "ACCOMMODATION",
        name: "住宿费",
        color: "cyan",
        sortOrder: 2,
      },
      {
        type: "EXPENSE_TYPE",
        code: "TRANSPORTATION",
        name: "交通费",
        color: "green",
        sortOrder: 3,
      },
      {
        type: "EXPENSE_TYPE",
        code: "ENTERTAINMENT",
        name: "招待费",
        color: "orange",
        sortOrder: 4,
      },
      {
        type: "EXPENSE_TYPE",
        code: "TEAM_BUILDING",
        name: "团建费",
        color: "purple",
        sortOrder: 5,
      },
      {
        type: "EXPENSE_TYPE",
        code: "COMMUNICATION",
        name: "通讯费",
        color: "geekblue",
        sortOrder: 6,
      },
      {
        type: "EXPENSE_TYPE",
        code: "OTHER",
        name: "其他",
        color: "default",
        sortOrder: 7,
      },
    ];

    return this.batchCreate(defaultTypes);
  }

  /**
   * 初始化默认合同类型
   */
  async initContractTypes() {
    const defaultTypes = [
      {
        type: "CONTRACT_TYPE",
        code: "SALES",
        name: "销售合同",
        color: "blue",
        sortOrder: 1,
        isDefault: true,
      },
      {
        type: "CONTRACT_TYPE",
        code: "PURCHASE",
        name: "采购合同",
        color: "cyan",
        sortOrder: 2,
      },
      {
        type: "CONTRACT_TYPE",
        code: "SERVICE",
        name: "服务合同",
        color: "green",
        sortOrder: 3,
      },
      {
        type: "CONTRACT_TYPE",
        code: "OTHER",
        name: "其他",
        color: "default",
        sortOrder: 4,
      },
    ];

    return this.batchCreate(defaultTypes);
  }
}
