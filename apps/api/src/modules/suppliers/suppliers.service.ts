// InfFinanceMs - 供应商服务

import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { QuerySupplierDto } from "./dto/query-supplier.dto";
import { Prisma } from "@prisma/client";
import {
  normalizePagination,
  resolveSortField,
} from "../../common/utils/query.utils";
import {
  createWithGeneratedCode,
  generatePrefixedCode,
} from "../../common/utils/code-generator.utils";
import { isUniqueConflict } from "../../common/utils/prisma.utils";
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

const ALLOWED_SUPPLIER_SORT_FIELDS = [
  "code",
  "name",
  "type",
  "createdAt",
  "updatedAt",
] as const;

const SUPPLIER_IMPORT_HEADER_ALIASES = {
  code: ["供应商编号", "supplier_code", "suppliercode", "code"],
  name: ["供应商名称", "supplier_name", "suppliername", "name"],
  type: ["供应商类型", "supplier_type", "suppliertype", "type"],
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
  bankName: ["开户银行", "bank_name", "bankname"],
  bankAccountName: ["户名", "银行户名", "bank_account_name", "bankaccountname"],
  bankAccountNo: ["银行账号", "账号", "bank_account_no", "bankaccountno"],
  remark: ["备注", "remark"],
} as const;
const SUPPLIER_TYPE_LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const CONTRACT_TYPE_HINT_CACHE_TTL_MS = 5 * 60 * 1000;
const SUPPLIER_OPTIONS_CACHE_TTL_MS = 60 * 1000;

type SupplierOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

@Injectable()
export class SuppliersService {
  private supplierTypeLookupCache: {
    expiresAt: number;
    lookup: Map<string, string>;
  } | null = null;
  private contractTypeHintsCache: {
    expiresAt: number;
    hintsByCode: Map<string, string[]>;
  } | null = null;
  private supplierOptionsCache: {
    expiresAt: number;
    items: SupplierOption[];
  } | null = null;

  constructor(private prisma: PrismaService) {}

  private toLookupKey(value: string): string {
    return normalizeText(value).toLowerCase();
  }

  private toNullable(value: string): string | null {
    const normalized = normalizeText(value || "");
    return normalized || null;
  }

  private toEncrypted(value: string | null | undefined): string | null {
    return encryptNullable(this.toNullable(value || ""));
  }

  private decodeSensitive(value: string | null | undefined): string | null {
    return decryptIfNeeded(value);
  }

  private decodeSupplier<T extends Record<string, unknown>>(item: T): T {
    if (!item) return item;
    const creditCode =
      "creditCode" in item
        ? this.decodeSensitive(item.creditCode as string | null | undefined)
        : undefined;
    const bankAccountNo =
      "bankAccountNo" in item
        ? this.decodeSensitive(item.bankAccountNo as string | null | undefined)
        : undefined;
    return {
      ...item,
      ...(creditCode !== undefined ? { creditCode } : {}),
      ...(bankAccountNo !== undefined ? { bankAccountNo } : {}),
    };
  }

  private async findSupplierByCreditCode(creditCode: string) {
    return this.prisma.supplier.findFirst({
      where: {
        isDeleted: false,
        OR: buildSensitiveFieldEqualsOr("creditCode", creditCode),
      },
    });
  }

  private async findDuplicateSupplierCreditCode(
    creditCode: string,
    currentId: string,
  ) {
    return this.prisma.supplier.findFirst({
      where: {
        isDeleted: false,
        NOT: { id: currentId },
        OR: buildSensitiveFieldEqualsOr("creditCode", creditCode),
      },
    });
  }

  private isSalesContractType(
    contractType: string | null | undefined,
    hintsByCode: Map<string, string[]>,
  ): boolean {
    if (!contractType) return false;
    const hintValues = [
      contractType,
      ...(hintsByCode.get(this.toLookupKey(contractType)) || []),
    ];
    return hintValues.some((value) => {
      const normalized = normalizeText(value).toUpperCase();
      return normalized.includes("SALES") || value.includes("销售");
    });
  }

  private buildWhere(
    keyword?: string,
    type?: string,
  ): Prisma.SupplierWhereInput {
    const where: Prisma.SupplierWhereInput = { isDeleted: false };
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

  private async getSupplierTypeLookup(): Promise<Map<string, string>> {
    const now = Date.now();
    if (
      this.supplierTypeLookupCache &&
      this.supplierTypeLookupCache.expiresAt > now
    ) {
      return new Map(this.supplierTypeLookupCache.lookup);
    }

    const map = new Map<string, string>();
    const dictItems = await this.prisma.dictionary.findMany({
      where: { type: "SUPPLIER_TYPE", isEnabled: true },
      select: { code: true, name: true, value: true },
    });
    dictItems.forEach((item) => {
      const candidates = [item.code, item.name || "", item.value || ""];
      candidates.forEach((candidate) => {
        const key = this.toLookupKey(candidate);
        if (key) map.set(key, item.code);
      });
    });

    map.set(this.toLookupKey("企业"), "CORPORATE");
    map.set(this.toLookupKey("corporate"), "CORPORATE");
    map.set(this.toLookupKey("公司"), "CORPORATE");
    map.set(this.toLookupKey("个人"), "PERSONAL");
    map.set(this.toLookupKey("personal"), "PERSONAL");

    this.supplierTypeLookupCache = {
      expiresAt: now + SUPPLIER_TYPE_LOOKUP_CACHE_TTL_MS,
      lookup: new Map(map),
    };

    return map;
  }

  private async getContractTypeHintsByCode(): Promise<Map<string, string[]>> {
    const now = Date.now();
    if (
      this.contractTypeHintsCache &&
      this.contractTypeHintsCache.expiresAt > now
    ) {
      return new Map(this.contractTypeHintsCache.hintsByCode);
    }

    const contractTypeDictionaries = await this.prisma.dictionary.findMany({
      where: { type: "CONTRACT_TYPE" },
      select: { code: true, name: true, value: true },
    });
    const hintsByCode = new Map<string, string[]>();
    contractTypeDictionaries.forEach((item) => {
      const key = this.toLookupKey(item.code);
      hintsByCode.set(
        key,
        [item.code, item.name || "", item.value || ""].filter(
          (value) => !!normalizeText(value),
        ),
      );
    });

    this.contractTypeHintsCache = {
      expiresAt: now + CONTRACT_TYPE_HINT_CACHE_TTL_MS,
      hintsByCode: new Map(hintsByCode),
    };

    return hintsByCode;
  }

  private resolveSupplierTypeCode(
    lookup: Map<string, string>,
    text: string,
  ): string | undefined {
    const key = this.toLookupKey(text);
    if (!key) return undefined;
    return lookup.get(key);
  }

  private getOptionsFromCache(): SupplierOption[] | null {
    if (!this.supplierOptionsCache) return null;
    if (this.supplierOptionsCache.expiresAt <= Date.now()) {
      this.supplierOptionsCache = null;
      return null;
    }
    return this.supplierOptionsCache.items;
  }

  private setOptionsCache(items: SupplierOption[]) {
    this.supplierOptionsCache = {
      expiresAt: Date.now() + SUPPLIER_OPTIONS_CACHE_TTL_MS,
      items,
    };
  }

  private invalidateOptionsCache() {
    this.supplierOptionsCache = null;
  }

  private async generateCode(): Promise<string> {
    return generatePrefixedCode({
      model: this.prisma.supplier,
      field: "code",
      prefix: "SUP",
      sequenceRegex: /^SUP(\d{6})$/,
      sequenceLength: 6,
    });
  }

  async findAll(query: QuerySupplierDto) {
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
      ALLOWED_SUPPLIER_SORT_FIELDS,
      "createdAt",
    );

    const where = this.buildWhere(keyword, type);

    const [items, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { [safeSortBy]: sortOrder },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    const supplierNames = Array.from(
      new Set(
        items
          .map((item) => normalizeText(item.name || ""))
          .filter((name) => !!name),
      ),
    );
    const [contracts, contractTypeHintsByCode] = await Promise.all([
      supplierNames.length > 0
        ? this.prisma.contract.findMany({
            where: {
              isDeleted: false,
              customer: {
                name: { in: supplierNames },
              },
            },
            select: {
              contractType: true,
              customer: {
                select: { name: true },
              },
            },
          })
        : Promise.resolve([]),
      this.getContractTypeHintsByCode(),
    ]);

    const contractCountBySupplier = new Map<string, number>();
    contracts.forEach((contract) => {
      if (
        this.isSalesContractType(contract.contractType, contractTypeHintsByCode)
      )
        return;
      const key = this.toLookupKey(contract.customer?.name || "");
      if (!key) return;
      contractCountBySupplier.set(
        key,
        (contractCountBySupplier.get(key) || 0) + 1,
      );
    });

    const itemsWithContractCount = items.map((item) => {
      const key = this.toLookupKey(item.name || "");
      return {
        ...this.decodeSupplier(item),
        contractCount: contractCountBySupplier.get(key) || 0,
      };
    });

    return {
      items: itemsWithContractCount,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, isDeleted: false },
    });
    if (!supplier) {
      throw new NotFoundException("供应商不存在");
    }
    return this.decodeSupplier(supplier);
  }

  async create(createSupplierDto: CreateSupplierDto) {
    const encryptedCreditCode = this.toEncrypted(createSupplierDto.creditCode);
    const encryptedBankAccountNo = this.toEncrypted(
      createSupplierDto.bankAccountNo,
    );
    if (encryptedCreditCode) {
      const existing = await this.findSupplierByCreditCode(
        createSupplierDto.creditCode!,
      );
      if (existing) {
        throw new ConflictException("该统一社会信用代码已存在");
      }
    }

    const created = await createWithGeneratedCode({
      generateCode: () => this.generateCode(),
      create: async (code: string) => {
        try {
          return await this.prisma.supplier.create({
            data: {
              ...createSupplierDto,
              creditCode: encryptedCreditCode,
              bankAccountNo: encryptedBankAccountNo,
              code,
            },
          });
        } catch (error) {
          if (isUniqueConflict(error, "creditCode")) {
            throw new ConflictException("该统一社会信用代码已存在");
          }
          throw error;
        }
      },
      isCodeConflict: (error) => isUniqueConflict(error, "code"),
      exhaustedError: () => new ConflictException("供应商编号生成失败，请重试"),
    });
    this.invalidateOptionsCache();
    return this.decodeSupplier(created);
  }

  async update(id: string, updateSupplierDto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);

    const incomingCreditCode = this.toNullable(
      updateSupplierDto.creditCode || "",
    );
    if (incomingCreditCode && incomingCreditCode !== supplier.creditCode) {
      const existing = await this.findDuplicateSupplierCreditCode(
        incomingCreditCode,
        id,
      );
      if (existing) {
        throw new ConflictException("该统一社会信用代码已存在");
      }
    }

    const updateData = {
      ...updateSupplierDto,
      ...(updateSupplierDto.creditCode !== undefined
        ? { creditCode: this.toEncrypted(updateSupplierDto.creditCode) }
        : {}),
      ...(updateSupplierDto.bankAccountNo !== undefined
        ? { bankAccountNo: this.toEncrypted(updateSupplierDto.bankAccountNo) }
        : {}),
    };

    const updated = await this.prisma.supplier.update({
      where: { id },
      data: updateData,
    });
    this.invalidateOptionsCache();
    return this.decodeSupplier(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    const removed = await this.prisma.supplier.update({
      where: { id },
      data: { isDeleted: true },
    });
    this.invalidateOptionsCache();
    return this.decodeSupplier(removed);
  }

  async getOptions() {
    const cached = this.getOptionsFromCache();
    if (cached) return cached;

    const items = await this.prisma.supplier.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { name: "asc" },
    });
    this.setOptionsCache(items);
    return items.map((item) => this.decodeSupplier(item));
  }

  private async buildExportPayload(query: QuerySupplierDto) {
    const where = this.buildWhere(query.keyword, query.type);
    const [items, supplierTypeLookup] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { createdAt: "desc" },
      }),
      this.getSupplierTypeLookup(),
    ]);

    const headers: string[] = [
      "供应商编号",
      "供应商名称",
      "供应商类型",
      "统一社会信用代码",
      "联系人",
      "联系电话",
      "联系邮箱",
      "地址",
      "开户银行",
      "户名",
      "银行账号",
      "备注",
    ];
    const rows: unknown[][] = items.map((item) => [
      item.code,
      item.name,
      supplierTypeLookup.get(this.toLookupKey(item.type)) || item.type,
      this.decodeSensitive(item.creditCode) || "",
      item.contactName || "",
      item.contactPhone || "",
      item.contactEmail || "",
      item.address || "",
      item.bankName || "",
      item.bankAccountName || "",
      this.decodeSensitive(item.bankAccountNo) || "",
      item.remark || "",
    ]);

    return { headers, rows };
  }

  async exportCsv(query: QuerySupplierDto) {
    const { headers, rows } = await this.buildExportPayload(query);
    return toCsv(headers, rows);
  }

  async exportExcel(query: QuerySupplierDto): Promise<Buffer> {
    const { headers, rows } = await this.buildExportPayload(query);
    return toXlsxBuffer(headers, rows);
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
    const codeIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.code,
    );
    const nameIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.name,
    );
    const typeIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.type,
    );
    const creditCodeIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.creditCode,
    );
    const contactNameIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.contactName,
    );
    const contactPhoneIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.contactPhone,
    );
    const contactEmailIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.contactEmail,
    );
    const addressIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.address,
    );
    const bankNameIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.bankName,
    );
    const bankAccountNameIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.bankAccountName,
    );
    const bankAccountNoIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.bankAccountNo,
    );
    const remarkIdx = resolveHeaderIndex(
      header,
      SUPPLIER_IMPORT_HEADER_ALIASES.remark,
    );

    const missing: string[] = [];
    if (nameIdx === undefined) missing.push("供应商名称");
    if (typeIdx === undefined) missing.push("供应商类型");
    if (missing.length > 0) {
      throw new ConflictException(`导入文件缺少字段: ${missing.join("、")}`);
    }

    const typeLookup = await this.getSupplierTypeLookup();
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
      const typeCode = this.resolveSupplierTypeCode(typeLookup, typeRaw);
      const creditCode = this.toNullable(getCell(row, creditCodeIdx));
      const encryptedCreditCode = this.toEncrypted(creditCode);
      const contactName = this.toNullable(getCell(row, contactNameIdx));
      const contactPhone = this.toNullable(getCell(row, contactPhoneIdx));
      const contactEmail = this.toNullable(getCell(row, contactEmailIdx));
      const address = this.toNullable(getCell(row, addressIdx));
      const bankName = this.toNullable(getCell(row, bankNameIdx));
      const bankAccountName = this.toNullable(getCell(row, bankAccountNameIdx));
      const bankAccountNo = this.toNullable(getCell(row, bankAccountNoIdx));
      const encryptedBankAccountNo = this.toEncrypted(bankAccountNo);
      const remark = this.toNullable(getCell(row, remarkIdx));

      if (!name) {
        errors.push({ row: rowNo, message: "供应商名称不能为空" });
        continue;
      }
      if (!typeCode) {
        errors.push({
          row: rowNo,
          message: `供应商类型无效: ${typeRaw || "(空)"}`,
        });
        continue;
      }

      try {
        const existingByCode = code
          ? await this.prisma.supplier.findFirst({
              where: { code, isDeleted: false },
            })
          : null;
        const existingByCredit =
          !existingByCode && creditCode
            ? await this.findSupplierByCreditCode(creditCode)
            : null;
        const existing = existingByCode || existingByCredit;

        if (existing) {
          if (
            creditCode &&
            isSensitiveFieldChanged(creditCode, existing.creditCode)
          ) {
            const duplicateCredit = await this.findDuplicateSupplierCreditCode(
              creditCode,
              existing.id,
            );
            if (duplicateCredit) {
              throw new ConflictException("统一社会信用代码已存在");
            }
          }
          await this.prisma.supplier.update({
            where: { id: existing.id },
            data: {
              name,
              type: typeCode,
              creditCode: encryptedCreditCode,
              contactName,
              contactPhone,
              contactEmail,
              address,
              bankName,
              bankAccountName,
              bankAccountNo: encryptedBankAccountNo,
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
          bankName,
          bankAccountName,
          bankAccountNo: encryptedBankAccountNo,
          remark,
        };

        if (code) {
          await this.prisma.supplier.create({
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
            this.prisma.supplier.create({
              data: {
                ...createData,
                code: autoCode,
              },
            }),
          isCodeConflict: (error) => isUniqueConflict(error, "code"),
          exhaustedError: () =>
            new ConflictException("供应商编号生成失败，请重试"),
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
