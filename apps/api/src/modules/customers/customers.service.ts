// InfFinanceMs - 客户服务

import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { QueryCustomerDto } from "./dto/query-customer.dto";
import { ApproveCustomerDto } from "./dto/approve-customer.dto";
import { ApprovalStatus, Prisma } from "@prisma/client";
import {
  normalizePagination,
  resolveSortField,
} from "../../common/utils/query.utils";
import {
  createWithGeneratedCode,
  generatePrefixedCode,
} from "../../common/utils/code-generator.utils";
import { isUniqueConflict as isPrismaUniqueConflict } from "../../common/utils/prisma.utils";
import { resolveErrorMessage } from "../../common/utils/error.utils";
import {
  normalizeText,
  parseTabularBuffer,
  resolveHeaderIndex,
  toCsv,
  toXlsxBuffer,
} from "../../common/utils/tabular.utils";
import {
  decryptIfNeeded,
  encryptNullable,
} from "../../common/utils/encryption.utils";
import {
  buildSensitiveFieldEqualsOr,
  isSensitiveFieldChanged,
} from "../../common/utils/sensitive-field.utils";

const ALLOWED_CUSTOMER_SORT_FIELDS = [
  "code",
  "name",
  "type",
  "approvalStatus",
  "createdAt",
  "updatedAt",
] as const;

const CUSTOMER_IMPORT_HEADER_ALIASES = {
  code: ["客户编号", "customer_code", "customercode", "code"],
  name: ["客户名称", "customer_name", "customername", "name"],
  type: ["客户类型", "customer_type", "customertype", "type"],
  creditCode: ["统一社会信用代码", "信用代码", "credit_code", "creditcode"],
  contactName: ["联系人", "contact_name", "contactname"],
  contactPhone: [
    "联系电话",
    "手机",
    "电话",
    "contact_phone",
    "contactphone",
    "phone",
  ],
  contactEmail: ["联系邮箱", "邮箱", "contact_email", "contactemail", "email"],
  address: ["地址", "address"],
  remark: ["备注", "remark"],
} as const;

const CUSTOMER_APPROVAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "待审批",
  APPROVED: "已通过",
  REJECTED: "已拒绝",
};
const CUSTOMER_TYPE_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const CUSTOMER_OPTIONS_CACHE_TTL_MS = 60 * 1000;

type CustomerOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

@Injectable()
export class CustomersService {
  private customerTypeLookupCache: {
    expiresAt: number;
    lookup: Map<string, string>;
  } | null = null;
  private customerOptionsCache: {
    expiresAt: number;
    items: CustomerOption[];
  } | null = null;

  constructor(private prisma: PrismaService) {}

  private toLookupKey(value: string): string {
    return normalizeText(value).toLowerCase();
  }

  private toNullable(value: string): string | null {
    const normalized = normalizeText(value || "");
    return normalized || null;
  }

  private toEncryptedCreditCode(
    value: string | null | undefined,
  ): string | null {
    return encryptNullable(this.toNullable(value || ""));
  }

  private decodeCreditCode(value: string | null | undefined): string | null {
    return decryptIfNeeded(value);
  }

  private decodeCustomer<T extends { creditCode?: string | null }>(item: T): T {
    if (!item) return item;
    return {
      ...item,
      creditCode: this.decodeCreditCode(item.creditCode),
    };
  }

  private async findCustomerByCreditCode(creditCode: string) {
    return this.prisma.customer.findFirst({
      where: {
        isDeleted: false,
        OR: buildSensitiveFieldEqualsOr("creditCode", creditCode),
      },
    });
  }

  private async findDuplicateCustomerCreditCode(
    creditCode: string,
    currentId: string,
  ) {
    return this.prisma.customer.findFirst({
      where: {
        isDeleted: false,
        NOT: { id: currentId },
        OR: buildSensitiveFieldEqualsOr("creditCode", creditCode),
      },
    });
  }

  private buildWhere(
    keyword?: string,
    type?: string,
  ): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = { isDeleted: false };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { code: { contains: keyword, mode: "insensitive" } },
        { contactName: { contains: keyword, mode: "insensitive" } },
      ];
    }
    if (type) {
      where.type = type;
    }
    return where;
  }

  private async getCustomerTypeLookup(): Promise<Map<string, string>> {
    const now = Date.now();
    if (
      this.customerTypeLookupCache &&
      this.customerTypeLookupCache.expiresAt > now
    ) {
      return new Map(this.customerTypeLookupCache.lookup);
    }

    const map = new Map<string, string>();
    const dictItems = await this.prisma.dictionary.findMany({
      where: { type: "CUSTOMER_TYPE", isEnabled: true },
      select: { code: true, name: true, value: true },
    });

    dictItems.forEach((item) => {
      const candidates = [item.code, item.name || "", item.value || ""];
      candidates.forEach((candidate) => {
        const key = this.toLookupKey(candidate);
        if (key) map.set(key, item.code);
      });
    });

    map.set(this.toLookupKey("企业"), "ENTERPRISE");
    map.set(this.toLookupKey("enterprise"), "ENTERPRISE");
    map.set(this.toLookupKey("个人"), "INDIVIDUAL");
    map.set(this.toLookupKey("individual"), "INDIVIDUAL");

    this.customerTypeLookupCache = {
      expiresAt: now + CUSTOMER_TYPE_LOOKUP_CACHE_TTL_MS,
      lookup: new Map(map),
    };

    return map;
  }

  private resolveCustomerTypeCode(
    lookup: Map<string, string>,
    text: string,
  ): string | undefined {
    const key = this.toLookupKey(text);
    if (!key) return undefined;
    return lookup.get(key);
  }

  private getOptionsFromCache(): CustomerOption[] | null {
    if (!this.customerOptionsCache) return null;
    if (this.customerOptionsCache.expiresAt <= Date.now()) {
      this.customerOptionsCache = null;
      return null;
    }
    return this.customerOptionsCache.items;
  }

  private setOptionsCache(items: CustomerOption[]) {
    this.customerOptionsCache = {
      expiresAt: Date.now() + CUSTOMER_OPTIONS_CACHE_TTL_MS,
      items,
    };
  }

  private invalidateOptionsCache() {
    this.customerOptionsCache = null;
  }

  /**
   * 生成客户编号
   */
  private async generateCode(): Promise<string> {
    return generatePrefixedCode({
      model: this.prisma.customer,
      field: "code",
      prefix: "CUS",
      sequenceRegex: /^CUS(\d{6})$/,
      sequenceLength: 6,
    });
  }

  private isUniqueConflict(error: unknown, field: string): boolean {
    return isPrismaUniqueConflict(error, field);
  }

  /**
   * 获取客户列表
   */
  async findAll(query: QueryCustomerDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      type,
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
      ALLOWED_CUSTOMER_SORT_FIELDS,
      "createdAt",
    );

    const where = this.buildWhere(keyword, type);

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          _count: {
            select: {
              contracts: {
                where: { isDeleted: false },
              },
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((item) => this.decodeCustomer(item)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  /**
   * 获取客户详情
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, isDeleted: false },
      include: {
        contracts: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            contracts: {
              where: { isDeleted: false },
            },
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("客户不存在");
    }

    return this.decodeCustomer(customer);
  }

  /**
   * 创建客户
   */
  async create(createCustomerDto: CreateCustomerDto, userId: string) {
    // 检查信用代码是否重复
    const encryptedCreditCode = this.toEncryptedCreditCode(
      createCustomerDto.creditCode,
    );
    if (encryptedCreditCode) {
      const existing = await this.findCustomerByCreditCode(
        createCustomerDto.creditCode!,
      );
      if (existing) {
        throw new ConflictException("该统一社会信用代码已存在");
      }
    }

    const created = await createWithGeneratedCode({
      generateCode: () => this.generateCode(),
      create: async (code: string) => {
        try {
          return await this.prisma.customer.create({
            data: {
              ...createCustomerDto,
              creditCode: encryptedCreditCode,
              code,
              approvalStatus: ApprovalStatus.PENDING,
              submittedBy: userId,
              submittedAt: new Date(),
            },
          });
        } catch (error) {
          if (this.isUniqueConflict(error, "creditCode")) {
            throw new ConflictException("该统一社会信用代码已存在");
          }
          throw error;
        }
      },
      isCodeConflict: (error) => this.isUniqueConflict(error, "code"),
      exhaustedError: () => new ConflictException("客户编号生成失败，请重试"),
    });
    this.invalidateOptionsCache();
    return this.decodeCustomer(created);
  }

  /**
   * 更新客户
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.findOne(id);

    // 检查信用代码是否重复
    const incomingCreditCode = this.toNullable(
      updateCustomerDto.creditCode || "",
    );
    if (incomingCreditCode && incomingCreditCode !== customer.creditCode) {
      const existing = await this.findDuplicateCustomerCreditCode(
        incomingCreditCode,
        id,
      );
      if (existing) {
        throw new ConflictException("该统一社会信用代码已存在");
      }
    }

    const updateData = {
      ...updateCustomerDto,
      ...(updateCustomerDto.creditCode !== undefined
        ? {
            creditCode: this.toEncryptedCreditCode(
              updateCustomerDto.creditCode,
            ),
          }
        : {}),
    };

    const updated = await this.prisma.customer.update({
      where: { id },
      data: updateData,
    });
    this.invalidateOptionsCache();
    return this.decodeCustomer(updated);
  }

  /**
   * 删除客户（软删除）
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有关联合同
    const contractCount = await this.prisma.contract.count({
      where: { customerId: id, isDeleted: false },
    });

    if (contractCount > 0) {
      throw new ConflictException("该客户存在关联合同，无法删除");
    }

    const removed = await this.prisma.customer.update({
      where: { id },
      data: { isDeleted: true },
    });
    this.invalidateOptionsCache();
    return this.decodeCustomer(removed);
  }

  /**
   * 获取客户选项列表（用于下拉选择）
   * 只返回已审批通过的客户
   */
  async getOptions() {
    const cached = this.getOptionsFromCache();
    if (cached) return cached;

    const items = await this.prisma.customer.findMany({
      where: {
        isDeleted: false,
        approvalStatus: ApprovalStatus.APPROVED, // 只返回已审批通过的客户
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    });
    this.setOptionsCache(items);
    return items;
  }

  /**
   * 审批客户
   */
  async approve(id: string, approveDto: ApproveCustomerDto, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, isDeleted: false },
    });

    if (!customer) {
      throw new NotFoundException("客户不存在");
    }

    // 检查审批状态：只有待审批或已拒绝的客户可以审批
    if (customer.approvalStatus === ApprovalStatus.APPROVED) {
      throw new ConflictException("该客户已审批通过，无法重复审批");
    }

    const { approved, remark } = approveDto;

    const approvalResult = await this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: approved
          ? ApprovalStatus.APPROVED
          : ApprovalStatus.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
        approvalRemark: remark,
      },
    });
    this.invalidateOptionsCache();
    return this.decodeCustomer(approvalResult);
  }

  /**
   * 获取待审批客户列表
   */
  async findPendingApproval(query: QueryCustomerDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      type,
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
      ALLOWED_CUSTOMER_SORT_FIELDS,
      "createdAt",
    );

    const where: Prisma.CustomerWhereInput = {
      isDeleted: false,
      approvalStatus: ApprovalStatus.PENDING, // 只查询待审批的客户
    };

    // 关键词搜索（名称、编号、联系人）
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: "insensitive" } },
        { code: { contains: keyword, mode: "insensitive" } },
        { contactName: { contains: keyword, mode: "insensitive" } },
      ];
    }

    // 客户类型筛选
    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          submitter: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items: items.map((item) => this.decodeCustomer(item)),
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  private async buildExportPayload(query: QueryCustomerDto) {
    const where = this.buildWhere(query.keyword, query.type);
    const [items, customerTypeLookup] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              contracts: {
                where: { isDeleted: false },
              },
            },
          },
        },
      }),
      this.getCustomerTypeLookup(),
    ]);

    const headers: string[] = [
      "客户编号",
      "客户名称",
      "客户类型",
      "统一社会信用代码",
      "联系人",
      "联系电话",
      "联系邮箱",
      "地址",
      "合同数",
      "审批状态",
      "备注",
    ];
    const rows: unknown[][] = items.map((item) => [
      item.code,
      item.name,
      customerTypeLookup.get(this.toLookupKey(item.type)) || item.type,
      this.decodeCreditCode(item.creditCode) || "",
      item.contactName || "",
      item.contactPhone || "",
      item.contactEmail || "",
      item.address || "",
      item._count?.contracts || 0,
      CUSTOMER_APPROVAL_STATUS_LABELS[item.approvalStatus] ||
        item.approvalStatus,
      item.remark || "",
    ]);

    return { headers, rows };
  }

  async exportCsv(query: QueryCustomerDto) {
    const { headers, rows } = await this.buildExportPayload(query);
    return toCsv(headers, rows);
  }

  async exportExcel(query: QueryCustomerDto): Promise<Buffer> {
    const { headers, rows } = await this.buildExportPayload(query);
    return toXlsxBuffer(headers, rows);
  }

  async importFile(fileBuffer: Buffer, fileName: string, userId: string) {
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
    const codeIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.code,
    );
    const nameIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.name,
    );
    const typeIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.type,
    );
    const creditCodeIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.creditCode,
    );
    const contactNameIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.contactName,
    );
    const contactPhoneIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.contactPhone,
    );
    const contactEmailIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.contactEmail,
    );
    const addressIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.address,
    );
    const remarkIdx = resolveHeaderIndex(
      header,
      CUSTOMER_IMPORT_HEADER_ALIASES.remark,
    );

    const missing: string[] = [];
    if (nameIdx === undefined) missing.push("客户名称");
    if (typeIdx === undefined) missing.push("客户类型");
    if (missing.length > 0) {
      throw new ConflictException(`导入文件缺少字段: ${missing.join("、")}`);
    }

    const typeLookup = await this.getCustomerTypeLookup();
    const errors: Array<{ row: number; message: string }> = [];
    let total = 0;
    let success = 0;

    const getCell = (row: string[], idx?: number): string => {
      if (idx === undefined) return "";
      return normalizeText(String(row[idx] || ""));
    };

    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (row.every((cell) => !normalizeText(cell))) continue;
      total += 1;
      const rowNo = i + 1;

      const code = this.toNullable(getCell(row, codeIdx));
      const name = this.toNullable(getCell(row, nameIdx));
      const typeRaw = getCell(row, typeIdx);
      const typeCode = this.resolveCustomerTypeCode(typeLookup, typeRaw);
      const creditCode = this.toNullable(getCell(row, creditCodeIdx));
      const encryptedCreditCode = this.toEncryptedCreditCode(creditCode);
      const contactName = this.toNullable(getCell(row, contactNameIdx));
      const contactPhone = this.toNullable(getCell(row, contactPhoneIdx));
      const contactEmail = this.toNullable(getCell(row, contactEmailIdx));
      const address = this.toNullable(getCell(row, addressIdx));
      const remark = this.toNullable(getCell(row, remarkIdx));

      if (!name) {
        errors.push({ row: rowNo, message: "客户名称不能为空" });
        continue;
      }
      if (!typeCode) {
        errors.push({
          row: rowNo,
          message: `客户类型无效: ${typeRaw || "(空)"}`,
        });
        continue;
      }

      try {
        const existingByCode = code
          ? await this.prisma.customer.findFirst({
              where: { code, isDeleted: false },
            })
          : null;
        const existingByCredit =
          !existingByCode && creditCode
            ? await this.findCustomerByCreditCode(creditCode)
            : null;
        const existing = existingByCode || existingByCredit;

        if (existing) {
          if (
            creditCode &&
            isSensitiveFieldChanged(creditCode, existing.creditCode)
          ) {
            const duplicateCredit = await this.findDuplicateCustomerCreditCode(
              creditCode,
              existing.id,
            );
            if (duplicateCredit) {
              throw new ConflictException("统一社会信用代码已存在");
            }
          }
          await this.prisma.customer.update({
            where: { id: existing.id },
            data: {
              name,
              type: typeCode,
              creditCode: encryptedCreditCode,
              contactName,
              contactPhone,
              contactEmail,
              address,
              remark,
            },
          });
          success += 1;
          continue;
        }

        const createData = {
          name,
          type: typeCode,
          creditCode: encryptedCreditCode,
          contactName,
          contactPhone,
          contactEmail,
          address,
          remark,
          approvalStatus: ApprovalStatus.APPROVED,
          submittedBy: userId,
          submittedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date(),
          approvalRemark: "批量导入自动通过",
        };

        if (code) {
          await this.prisma.customer.create({
            data: {
              ...createData,
              code,
            },
          });
          success += 1;
          continue;
        }

        await createWithGeneratedCode({
          generateCode: () => this.generateCode(),
          create: (autoCode: string) =>
            this.prisma.customer.create({
              data: {
                ...createData,
                code: autoCode,
              },
            }),
          isCodeConflict: (error) => this.isUniqueConflict(error, "code"),
          exhaustedError: () =>
            new ConflictException("客户编号生成失败，请重试"),
        });
        success += 1;
      } catch (error: unknown) {
        const message = resolveErrorMessage(error, "导入失败");
        errors.push({ row: rowNo, message: String(message) });
      }
    }

    if (success > 0) {
      this.invalidateOptionsCache();
    }

    return {
      total,
      success,
      failed: total - success,
      errors,
    };
  }
}
