// InfFinanceMs - 合同服务

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';
import { read as readWorkbook, utils as xlsxUtils, write as writeWorkbook } from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { UploadService } from '../upload/upload.service';

// 合同状态常量
const ContractStatus = {
  DRAFT: 'DRAFT',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;
type ContractStatusType = typeof ContractStatus[keyof typeof ContractStatus];

const ALLOWED_CONTRACT_SORT_FIELDS = [
  'contractNo',
  'name',
  'signingEntity',
  'contractType',
  'amountWithTax',
  'signDate',
  'endDate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

function formatCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.map((item) => formatCsvCell(item)).join(',');
  const body = rows.map((row) => row.map((item) => formatCsvCell(item)).join(','));
  return [head, ...body].join('\n');
}

function toXlsxBuffer(headers: string[], rows: unknown[][]): Buffer {
  const wb = xlsxUtils.book_new();
  const ws = xlsxUtils.aoa_to_sheet([headers, ...rows]);
  xlsxUtils.book_append_sheet(wb, ws, 'Sheet1');
  return writeWorkbook(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function formatDateOnly(value?: Date | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function normalizeText(value: string): string {
  return value.trim().replace(/^\uFEFF/, '');
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      cells.push(normalizeText(current));
      current = '';
      continue;
    }

    current += ch;
  }

  cells.push(normalizeText(current));
  return cells;
}

function toDateString(value: string): string | null {
  const text = normalizeText(value);
  if (!text) return null;

  const normalizeValidDate = (date: Date): string | null => {
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    if (year < 1900 || year > 2100) return null;
    return date.toISOString().slice(0, 10);
  };

  // YYYY-MM-DD / YYYY/MM/DD / YYYY.M.D
  const ymdMatched = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdMatched) {
    const year = Number(ymdMatched[1]);
    const month = Number(ymdMatched[2]);
    const day = Number(ymdMatched[3]);
    const normalized = normalizeValidDate(new Date(Date.UTC(year, month - 1, day)));
    if (!normalized) return null;
    const [ny, nm, nd] = normalized.split('-').map((n) => Number(n));
    if (ny !== year || nm !== month || nd !== day) return null;
    return normalized;
  }

  // YYYYMMDD
  const compactMatched = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatched) {
    const year = Number(compactMatched[1]);
    const month = Number(compactMatched[2]);
    const day = Number(compactMatched[3]);
    const normalized = normalizeValidDate(new Date(Date.UTC(year, month - 1, day)));
    if (!normalized) return null;
    const [ny, nm, nd] = normalized.split('-').map((n) => Number(n));
    if (ny !== year || nm !== month || nd !== day) return null;
    return normalized;
  }

  // Excel serial date, e.g. 46025 -> 2026-01-03
  const asNumber = Number(text);
  if (!Number.isNaN(asNumber) && Number.isFinite(asNumber) && asNumber > 0 && asNumber < 100000) {
    const serial = Math.floor(asNumber);
    const excelEpochUtc = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpochUtc + serial * 24 * 60 * 60 * 1000);
    const normalized = normalizeValidDate(date);
    if (normalized) return normalized;
  }

  return normalizeValidDate(new Date(text));
}

function toNumber(value: string): number | null {
  const raw = normalizeText(value).replace(/[¥￥,\s]/g, '');
  if (!raw) return null;
  const result = Number(raw);
  if (Number.isNaN(result)) return null;
  return result;
}

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  EXECUTING: '执行中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
};

type ImportContractResult = {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

type ImportCsvOptions = {
  allowPartial?: boolean;
  fileName?: string;
  operatorId?: string;
};

type ImportPreviewResult = {
  total: number;
  valid: number;
  invalid: number;
  errors: Array<{ row: number; message: string }>;
  samples: Array<{
    row: number;
    contractNo: string;
    name: string;
    customerName: string;
    contractType: string;
    amount: number;
    signDate: string;
  }>;
};

type ImportHistoryItem = {
  id: string;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  allowPartial: boolean;
  errors: Array<{ row: number; message: string }>;
  createdAt: Date;
  operator?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type PreparedImportRow = {
  row: number;
  customerName: string;
  contractTypeText: string;
  contractData: Omit<CreateContractDto, 'customerId'>;
};

type PreparedImportResult = {
  total: number;
  validRows: PreparedImportRow[];
  errors: Array<{ row: number; message: string }>;
  contractTypeCodeByLookup: Map<string, string>;
};

const IMPORT_HEADER_ALIASES = {
  contractNo: ['合同编号', 'contract_no', 'contractno', 'no'],
  name: ['合同名称', 'name', 'contract_name', 'contractname'],
  customerName: ['客户名称', 'customer_name', 'customername', 'customer'],
  signingEntity: ['公司签约主体', '签约主体', 'signing_entity', 'signingentity', 'company'],
  contractType: ['合同类型', 'contract_type', 'contracttype', 'type'],
  amount: ['合同金额', '金额', 'contract_amount', 'contractamount', 'amount'],
  signDate: ['签署日期', '签订日期', 'sign_date', 'signdate'],
  endDate: ['结束日期', '到期日期', 'end_date', 'enddate'],
} as const;

const IMPORT_CUSTOMER_REMARK_VISIBLE = '由合同导入自动创建，待完善客户信息';
const IMPORT_CUSTOMER_REMARK_HIDDEN_NON_SALES = '由非销售合同自动创建（隐藏），仅用于合同关联';

function normalizeHeader(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[\s_\-/:：]/g, '')
    .replace(/[^\u4e00-\u9fa5a-z0-9]/g, '');
}

function getFileExtension(fileName?: string): string {
  if (!fileName) return '';
  const idx = fileName.lastIndexOf('.');
  if (idx < 0) return '';
  return fileName.slice(idx).toLowerCase();
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  private resolveAttachmentMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeByExt: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeByExt[ext] || 'application/octet-stream';
  }

  private attachmentNameScore(value: string): number {
    const cjkCount = (value.match(/[\u4e00-\u9fff]/g) || []).length;
    const replacementCount = (value.match(/\uFFFD/g) || []).length;
    const mojibakeHintCount = (value.match(/[ÃÂ]/g) || []).length;
    return cjkCount * 3 - replacementCount * 4 - mojibakeHintCount * 2;
  }

  private normalizeAttachmentName(value?: string | null): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    const decoded = Buffer.from(raw, 'latin1').toString('utf8').trim();
    if (!decoded) return raw;

    return this.attachmentNameScore(decoded) > this.attachmentNameScore(raw)
      ? decoded.normalize('NFC')
      : raw;
  }

  async getAttachmentDownloadPayload(id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, isDeleted: false },
      select: {
        contractNo: true,
        attachmentUrl: true,
        attachmentName: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (!contract.attachmentUrl) {
      throw new BadRequestException('该合同暂无附件');
    }

    const fullPath = this.uploadService.getFilePath(contract.attachmentUrl);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('附件不存在或已被删除');
    }

    const filenameRaw =
      contract.attachmentName?.trim()
      || path.basename(fullPath)
      || `${contract.contractNo}-附件`;
    const filename = this.normalizeAttachmentName(filenameRaw) || filenameRaw;

    return {
      filename,
      mimeType: this.resolveAttachmentMimeType(filename),
      buffer: fs.readFileSync(fullPath),
    };
  }

  private normalizeContractNo(value?: string): string {
    return normalizeText(value || '');
  }

  private toLookupKey(value: string): string {
    return normalizeText(value).toLowerCase();
  }

  private resolveDictionaryCodeByText(
    codeByLookup: Map<string, string>,
    text: string,
  ): string | undefined {
    const key = this.toLookupKey(text);
    if (!key) return undefined;
    return codeByLookup.get(key);
  }

  private registerDictionaryLookup(
    codeByLookup: Map<string, string>,
    item: { code: string; name?: string | null; value?: string | null },
  ) {
    const candidates = [item.code, item.name || '', item.value || ''];
    candidates.forEach((value) => {
      const key = this.toLookupKey(value);
      if (key) {
        codeByLookup.set(key, item.code);
      }
    });
  }

  private async generateCustomerCodeForImport(): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      where: {
        code: {
          startsWith: 'CUS',
        },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (lastCustomer?.code) {
      const match = lastCustomer.code.match(/^CUS(\d{6})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `CUS${String(sequence).padStart(6, '0')}`;
  }

  private async generateAutoContractTypeCodeForImport(): Promise<string> {
    const prefix = 'AUTO_CT_';
    const lastType = await this.prisma.dictionary.findFirst({
      where: {
        type: 'CONTRACT_TYPE',
        code: {
          startsWith: prefix,
        },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (lastType?.code) {
      const match = lastType.code.match(/^AUTO_CT_(\d{6})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(6, '0')}`;
  }

  private async generateSupplierCodeForAutoCreate(): Promise<string> {
    const lastSupplier = await this.prisma.supplier.findFirst({
      where: {
        code: {
          startsWith: 'SUP',
        },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (lastSupplier?.code) {
      const match = lastSupplier.code.match(/^SUP(\d{6})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `SUP${String(sequence).padStart(6, '0')}`;
  }

  private toSuggestedContractTypeCode(contractTypeText: string): string | null {
    const normalized = normalizeText(contractTypeText)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) return null;
    return normalized.length > 40 ? normalized.slice(0, 40) : normalized;
  }

  private async getNextContractTypeSortOrderForImport(): Promise<number> {
    const lastType = await this.prisma.dictionary.findFirst({
      where: { type: 'CONTRACT_TYPE' },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      select: { sortOrder: true },
    });
    return (lastType?.sortOrder || 0) + 1;
  }

  private isUniqueConflict(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes(field);
  }

  private async getDefaultCustomerTypeForImport(): Promise<string> {
    const preferred = await this.prisma.dictionary.findFirst({
      where: {
        type: 'CUSTOMER_TYPE',
        isEnabled: true,
        isDefault: true,
      },
      select: { code: true },
    });

    if (preferred?.code) {
      return preferred.code;
    }

    const fallback = await this.prisma.dictionary.findFirst({
      where: {
        type: 'CUSTOMER_TYPE',
        isEnabled: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { code: true },
    });

    return fallback?.code || 'ENTERPRISE';
  }

  private getDefaultSupplierTypeForAutoCreate(): string {
    return 'CORPORATE';
  }

  private async ensureCustomerForImport(
    customerName: string,
    customerIdByName: Map<string, string>,
    defaultCustomerType: string,
    operatorId?: string,
    options?: { visibleInCustomerList?: boolean },
  ): Promise<string> {
    const cached = customerIdByName.get(customerName);
    if (cached) {
      return cached;
    }

    const visibleInCustomerList = options?.visibleInCustomerList !== false;

    const existing = await this.prisma.customer.findFirst({
      where: {
        name: customerName,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (existing) {
      customerIdByName.set(customerName, existing.id);
      return existing.id;
    }

    const existingHidden = await this.prisma.customer.findFirst({
      where: {
        name: customerName,
        isDeleted: true,
      },
      select: { id: true },
    });
    if (existingHidden) {
      if (visibleInCustomerList) {
        await this.prisma.customer.update({
          where: { id: existingHidden.id },
          data: {
            isDeleted: false,
          },
        });
      }
      customerIdByName.set(customerName, existingHidden.id);
      return existingHidden.id;
    }

    for (let i = 0; i < 8; i += 1) {
      const code = await this.generateCustomerCodeForImport();
      try {
        const created = await this.prisma.customer.create({
          data: {
            code,
            name: customerName,
            type: defaultCustomerType,
            isDeleted: !visibleInCustomerList,
            approvalStatus: ApprovalStatus.PENDING,
            submittedBy: operatorId,
            submittedAt: operatorId ? new Date() : undefined,
            remark: visibleInCustomerList
              ? IMPORT_CUSTOMER_REMARK_VISIBLE
              : IMPORT_CUSTOMER_REMARK_HIDDEN_NON_SALES,
          },
          select: { id: true },
        });
        customerIdByName.set(customerName, created.id);
        return created.id;
      } catch (error) {
        if (this.isUniqueConflict(error, 'code')) {
          if (i < 7) {
            continue;
          }
          break;
        }
        throw error;
      }
    }

    throw new ConflictException(`自动创建客户失败: ${customerName}`);
  }

  private async ensureSupplierForCounterparty(
    supplierName: string,
    supplierIdByName: Map<string, string>,
    defaultSupplierType: string,
  ): Promise<string> {
    const cached = supplierIdByName.get(supplierName);
    if (cached) {
      return cached;
    }

    const existing = await this.prisma.supplier.findFirst({
      where: {
        name: supplierName,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (existing) {
      supplierIdByName.set(supplierName, existing.id);
      return existing.id;
    }

    for (let i = 0; i < 8; i += 1) {
      const code = await this.generateSupplierCodeForAutoCreate();
      try {
        const created = await this.prisma.supplier.create({
          data: {
            code,
            name: supplierName,
            type: defaultSupplierType,
            remark: '由合同自动同步创建，待完善供应商信息',
          },
          select: { id: true },
        });
        supplierIdByName.set(supplierName, created.id);
        return created.id;
      } catch (error) {
        if (this.isUniqueConflict(error, 'code')) {
          if (i < 7) {
            continue;
          }
          break;
        }
        throw error;
      }
    }

    throw new ConflictException(`自动创建供应商失败: ${supplierName}`);
  }

  private isSalesContractType(values: string[]): boolean {
    return values.some((value) => {
      const normalized = normalizeText(value).toUpperCase();
      return normalized.includes('SALES') || value.includes('销售');
    });
  }

  private async resolveContractTypeHintsByCode(contractTypeCode?: string): Promise<string[]> {
    if (!contractTypeCode) return [];
    const hints: string[] = [contractTypeCode];
    const dictionaryItem = await this.prisma.dictionary.findFirst({
      where: {
        type: 'CONTRACT_TYPE',
        code: { equals: contractTypeCode, mode: Prisma.QueryMode.insensitive },
      },
      select: { name: true, value: true },
    });
    if (dictionaryItem?.name) hints.push(dictionaryItem.name);
    if (dictionaryItem?.value) hints.push(dictionaryItem.value);
    return hints;
  }

  private async isSalesByContractType(args: {
    contractTypeCode?: string;
    contractTypeText?: string;
  }): Promise<boolean> {
    const contractTypeHints = [
      ...(await this.resolveContractTypeHintsByCode(args.contractTypeCode)),
      ...(args.contractTypeText ? [args.contractTypeText] : []),
    ];
    return this.isSalesContractType(contractTypeHints);
  }

  private async syncCounterpartyByContractType(args: {
    contractTypeCode?: string;
    contractTypeText?: string;
    counterpartyName?: string;
    supplierIdByName: Map<string, string>;
    defaultSupplierType: string;
    isSalesContractType?: boolean;
  }) {
    const counterpartyName = normalizeText(args.counterpartyName || '');
    if (!counterpartyName) return;

    const isSalesContractType =
      args.isSalesContractType ?? await this.isSalesByContractType(args);
    if (isSalesContractType) {
      return;
    }

    await this.ensureSupplierForCounterparty(
      counterpartyName,
      args.supplierIdByName,
      args.defaultSupplierType,
    );
  }

  private async ensureContractTypeForImport(
    contractTypeText: string,
    resolvedContractTypeCode: string | undefined,
    contractTypeCodeByLookup: Map<string, string>,
    sortOrderState: { next: number },
  ): Promise<string> {
    const normalizedContractTypeText = normalizeText(contractTypeText);
    if (!normalizedContractTypeText) {
      throw new BadRequestException('合同类型不能为空');
    }

    if (resolvedContractTypeCode) {
      this.registerDictionaryLookup(contractTypeCodeByLookup, {
        code: resolvedContractTypeCode,
        name: normalizedContractTypeText,
        value: normalizedContractTypeText,
      });
      return resolvedContractTypeCode;
    }

    const cachedCode = this.resolveDictionaryCodeByText(
      contractTypeCodeByLookup,
      normalizedContractTypeText,
    );
    if (cachedCode) return cachedCode;

    const existing = await this.prisma.dictionary.findFirst({
      where: {
        type: 'CONTRACT_TYPE',
        OR: [
          { code: { equals: normalizedContractTypeText, mode: Prisma.QueryMode.insensitive } },
          { name: { equals: normalizedContractTypeText, mode: Prisma.QueryMode.insensitive } },
          { value: { equals: normalizedContractTypeText, mode: Prisma.QueryMode.insensitive } },
        ],
      },
      select: { code: true, name: true, value: true },
    });

    if (existing) {
      this.registerDictionaryLookup(contractTypeCodeByLookup, existing);
      return existing.code;
    }

    const suggestedCode = this.toSuggestedContractTypeCode(normalizedContractTypeText);
    const candidateCodes: string[] = [];
    if (suggestedCode) {
      candidateCodes.push(suggestedCode);
    }

    for (let i = 0; i < 8; i += 1) {
      candidateCodes.push(await this.generateAutoContractTypeCodeForImport());
    }

    for (const code of candidateCodes) {
      try {
        const created = await this.prisma.dictionary.create({
          data: {
            type: 'CONTRACT_TYPE',
            code,
            name: normalizedContractTypeText,
            value: normalizedContractTypeText,
            color: 'default',
            sortOrder: sortOrderState.next,
            isDefault: false,
            isEnabled: true,
            remark: '由合同导入自动创建',
          },
          select: { code: true, name: true, value: true },
        });
        sortOrderState.next += 1;
        this.registerDictionaryLookup(contractTypeCodeByLookup, created);
        return created.code;
      } catch (error) {
        if (this.isUniqueConflict(error, 'code')) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException(`自动创建合同类型失败: ${normalizedContractTypeText}`);
  }

  /**
   * 获取合同列表
   */
  async findAll(query: QueryContractDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      customerKeyword,
      signYear,
      contractType,
      status,
      customerId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_CONTRACT_SORT_FIELDS, 'createdAt');

    const where: Prisma.ContractWhereInput = {
      isDeleted: false,
    };

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { contractNo: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
        {
          customer: {
            name: {
              contains: keyword,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    // 客户名称模糊搜索
    if (customerKeyword) {
      where.customer = {
        name: {
          contains: customerKeyword,
          mode: 'insensitive',
        },
      };
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 客户筛选
    if (customerId) {
      where.customerId = customerId;
    }

    // 合同类型筛选
    if (contractType) {
      where.contractType = contractType;
    }

    // 日期范围筛选
    const signDateFilter: Prisma.DateTimeFilter = {};

    if (signYear) {
      signDateFilter.gte = new Date(signYear, 0, 1, 0, 0, 0, 0);
      signDateFilter.lte = new Date(signYear, 11, 31, 23, 59, 59, 999);
    }

    if (startDate) {
      const rangeStart = parseDateRangeStart(startDate);
      signDateFilter.gte =
        signDateFilter.gte && signDateFilter.gte > rangeStart ? signDateFilter.gte : rangeStart;
    }

    if (endDate) {
      const rangeEnd = parseDateRangeEnd(endDate);
      signDateFilter.lte =
        signDateFilter.lte && signDateFilter.lte < rangeEnd ? signDateFilter.lte : rangeEnd;
    }

    if (signDateFilter.gte || signDateFilter.lte) {
      where.signDate = signDateFilter;
    }

    const [items, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: {
              paymentRecords: true,
              invoices: true,
            },
          },
        },
      }),
      this.prisma.contract.count({ where }),
    ]);

    // 批量聚合回款，避免 N+1 查询
    const contractIds = items.map((item) => item.id);
    const paymentSums = contractIds.length
      ? await this.prisma.paymentRecord.groupBy({
          by: ['contractId'],
          where: {
            contractId: { in: contractIds },
          },
          _sum: { amount: true },
        })
      : [];

    const paymentMap = new Map(
      paymentSums.map((row) => [row.contractId, row._sum.amount || new Decimal(0)]),
    );

    const itemsWithPayment = items.map((contract) => {
      const totalPaid = paymentMap.get(contract.id) || new Decimal(0);
      return {
        ...contract,
        totalPaid,
        receivable: new Decimal(contract.amountWithTax.toString()).minus(totalPaid),
      };
    });

    return {
      items: itemsWithPayment,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 导出合同列表 CSV
   */
  async exportCsv(query: QueryContractDto) {
    const data = await this.findAll({
      ...query,
      page: 1,
      pageSize: 10000,
      sortBy: query.sortBy || 'signDate',
      sortOrder: query.sortOrder || 'desc',
    });

    const headers = [
      '合同编号',
      '签约年份',
      '合同名称',
      '客户名称',
      '公司签约主体',
      '合同类型',
      '合同金额',
      '签署日期',
      '结束日期',
      '状态',
    ];

    const rows = data.items.map((item: any) => {
      const signDate = item.signDate instanceof Date ? item.signDate : new Date(item.signDate);
      const endDate = item.endDate instanceof Date ? item.endDate : item.endDate ? new Date(item.endDate) : null;
      return [
        item.contractNo,
        Number.isNaN(signDate.getTime()) ? '' : signDate.getFullYear(),
        item.name,
        item.customer?.name || '',
        item.signingEntity || '',
        item.contractType || '',
        item.amountWithTax?.toString?.() || item.amountWithTax || '0',
        formatDateOnly(signDate),
        formatDateOnly(endDate),
        CONTRACT_STATUS_LABELS[item.status] || item.status,
      ];
    });

    return toCsv(headers, rows);
  }

  /**
   * 导出合同列表 Excel
   */
  async exportExcel(query: QueryContractDto): Promise<Buffer> {
    const data = await this.findAll({
      ...query,
      page: 1,
      pageSize: 10000,
      sortBy: query.sortBy || 'signDate',
      sortOrder: query.sortOrder || 'desc',
    });

    const headers = [
      '合同编号',
      '签约年份',
      '合同名称',
      '客户名称',
      '公司签约主体',
      '合同类型',
      '合同金额',
      '签署日期',
      '结束日期',
      '状态',
    ];

    const rows = data.items.map((item: any) => {
      const signDate = item.signDate instanceof Date ? item.signDate : new Date(item.signDate);
      const endDate = item.endDate instanceof Date ? item.endDate : item.endDate ? new Date(item.endDate) : null;
      return [
        item.contractNo,
        Number.isNaN(signDate.getTime()) ? '' : signDate.getFullYear(),
        item.name,
        item.customer?.name || '',
        item.signingEntity || '',
        item.contractType || '',
        item.amountWithTax?.toString?.() || item.amountWithTax || '0',
        formatDateOnly(signDate),
        formatDateOnly(endDate),
        CONTRACT_STATUS_LABELS[item.status] || item.status,
      ];
    });

    return toXlsxBuffer(headers, rows);
  }

  /**
   * 下载合同导入模板（Excel）
   */
  getImportTemplateExcel(): Buffer {
    const headers = ['合同编号', '合同名称', '客户名称', '公司签约主体', '合同类型', '合同金额', '签署日期', '结束日期'];
    const rows = [['HT-CUSTOM-0001', '示例合同A', '北京科技有限公司', 'InfFinanceMs', '服务合同', 100000, '2026-03-18', '2026-12-31']];
    return toXlsxBuffer(headers, rows);
  }

  private parseImportRows(fileBuffer: Buffer, fileName?: string): string[][] {
    const extension = getFileExtension(fileName);

    if (extension === '.xlsx' || extension === '.xls') {
      const workbook = readWorkbook(fileBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new BadRequestException('Excel 内容为空');
      }
      const sheet = workbook.Sheets[firstSheetName];
      const matrix = xlsxUtils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: '',
      }) as unknown[][];
      return matrix
        .map((row) => row.map((cell) => normalizeText(String(cell ?? ''))))
        .filter((row) => row.some((cell) => cell.length > 0));
    }

    const content = fileBuffer.toString('utf-8');
    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => parseCsvLine(line));
  }

  private async prepareImportRows(fileBuffer: Buffer, fileName?: string): Promise<PreparedImportResult> {
    const rows = this.parseImportRows(fileBuffer, fileName);

    if (rows.length < 2) {
      throw new BadRequestException('导入内容为空或缺少数据行');
    }

    const headers = rows[0];
    const normalizedHeaders = headers.map((header) => normalizeHeader(header));
    const indexByHeader = normalizedHeaders.reduce<Record<string, number>>((acc, header, index) => {
      if (header && acc[header] === undefined) {
        acc[header] = index;
      }
      return acc;
    }, {});

    const resolveHeaderIndex = (aliases: readonly string[]) => {
      const normalizedAliases = aliases.map((alias) => normalizeHeader(alias)).filter(Boolean);

      // 1) 精确匹配
      for (const alias of normalizedAliases) {
        const idx = indexByHeader[alias];
        if (idx !== undefined) return idx;
      }

      // 2) 容错匹配：支持“签署日期（必填）”/“sign_date_required”等扩展写法
      for (let i = 0; i < normalizedHeaders.length; i += 1) {
        const header = normalizedHeaders[i];
        if (!header) continue;
        const matched = normalizedAliases.some(
          (alias) => header.includes(alias) || alias.includes(header),
        );
        if (matched) return i;
      }

      // 3) 原始文本兜底（忽略大小写）
      for (const alias of aliases) {
        const idx = headers.findIndex(
          (header) => normalizeText(header).toLowerCase() === normalizeText(alias).toLowerCase(),
        );
        if (idx >= 0) return idx;
      }
      return undefined;
    };

    const contractNoIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.contractNo);
    const nameIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.name);
    const customerNameIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.customerName);
    const signingEntityIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.signingEntity);
    const contractTypeIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.contractType);
    const amountIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.amount);
    const signDateIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.signDate);
    const endDateIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.endDate);

    const missingHeaders: string[] = [];
    if (contractNoIdx === undefined) missingHeaders.push('合同编号/contract_no');
    if (nameIdx === undefined) missingHeaders.push('合同名称/name');
    if (customerNameIdx === undefined) missingHeaders.push('客户名称/customer_name');
    if (signingEntityIdx === undefined) missingHeaders.push('公司签约主体/signing_entity');
    if (contractTypeIdx === undefined) missingHeaders.push('合同类型/contract_type');
    if (amountIdx === undefined) missingHeaders.push('合同金额/amount');
    if (signDateIdx === undefined) missingHeaders.push('签署日期/sign_date');
    if (missingHeaders.length > 0) {
      throw new BadRequestException(`导入文件缺少必要字段: ${missingHeaders.join('、')}`);
    }

    const contractTypes = await this.prisma.dictionary.findMany({
      where: { type: 'CONTRACT_TYPE' },
      select: { code: true, name: true, value: true },
    });
    const contractTypeCodeByLookup = new Map<string, string>();
    contractTypes.forEach((type) => {
      this.registerDictionaryLookup(contractTypeCodeByLookup, type);
    });

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: PreparedImportRow[] = [];

    for (let i = 1; i < rows.length; i += 1) {
      const rowNumber = i + 1;
      const cells = rows[i];
      const getByIndex = (idx?: number) => normalizeText(idx === undefined ? '' : cells[idx] || '');

      const contractNo = this.normalizeContractNo(getByIndex(contractNoIdx));
      const name = getByIndex(nameIdx);
      const customerName = getByIndex(customerNameIdx);
      const signingEntity = getByIndex(signingEntityIdx) || 'InfFinanceMs';
      const contractTypeRaw = getByIndex(contractTypeIdx);
      const amount = toNumber(getByIndex(amountIdx));
      const signDate = toDateString(getByIndex(signDateIdx));
      const endDate = toDateString(getByIndex(endDateIdx));

      if (!contractNo) {
        errors.push({ row: rowNumber, message: '合同编号不能为空' });
        continue;
      }
      if (!name) {
        errors.push({ row: rowNumber, message: '合同名称不能为空' });
        continue;
      }
      if (!customerName) {
        errors.push({ row: rowNumber, message: '客户名称不能为空' });
        continue;
      }
      if (amount === null || amount < 0) {
        errors.push({ row: rowNumber, message: '合同金额无效' });
        continue;
      }
      if (!signDate) {
        errors.push({ row: rowNumber, message: '签署日期格式无效' });
        continue;
      }
      if (!contractTypeRaw) {
        errors.push({ row: rowNumber, message: '合同类型不能为空' });
        continue;
      }
      const contractTypeCode = this.resolveDictionaryCodeByText(contractTypeCodeByLookup, contractTypeRaw);

      validRows.push({
        row: rowNumber,
        customerName,
        contractTypeText: contractTypeRaw,
        contractData: {
          contractNo,
          name,
          signingEntity,
          contractType: contractTypeCode,
          amountWithTax: amount,
          amountWithoutTax: amount,
          taxRate: 0,
          signDate,
          endDate: endDate || undefined,
          attachmentUrl: '',
        } as CreateContractDto,
      });
    }

    return {
      total: rows.length - 1,
      validRows,
      errors,
      contractTypeCodeByLookup,
    };
  }

  async previewImportCsv(fileBuffer: Buffer, fileName?: string): Promise<ImportPreviewResult> {
    const prepared = await this.prepareImportRows(fileBuffer, fileName);
    return {
      total: prepared.total,
      valid: prepared.validRows.length,
      invalid: prepared.errors.length,
      errors: prepared.errors,
      samples: prepared.validRows.slice(0, 5).map((row) => ({
        row: row.row,
        contractNo: row.contractData.contractNo,
        name: row.contractData.name,
        customerName: row.customerName,
        contractType: row.contractTypeText,
        amount: Number(row.contractData.amountWithTax),
        signDate: row.contractData.signDate,
      })),
    };
  }

  private toImportErrors(raw: unknown): Array<{ row: number; message: string }> {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => ({
        row: Number((item as any)?.row || 0),
        message: String((item as any)?.message || ''),
      }))
      .filter((item) => item.row > 0 && item.message);
  }

  private async saveImportLog(args: {
    fileName: string;
    total: number;
    success: number;
    failed: number;
    allowPartial: boolean;
    errors: Array<{ row: number; message: string }>;
    operatorId?: string;
  }) {
    return this.prisma.contractImportLog.create({
      data: {
        fileName: args.fileName,
        total: args.total,
        success: args.success,
        failed: args.failed,
        allowPartial: args.allowPartial,
        errors: args.errors as unknown as Prisma.InputJsonValue,
        operatorId: args.operatorId,
      },
    });
  }

  /**
   * 批量导入合同（CSV）
   */
  async importCsv(fileBuffer: Buffer, options?: ImportCsvOptions): Promise<ImportContractResult> {
    const prepared = await this.prepareImportRows(fileBuffer, options?.fileName);
    const allowPartial = !!options?.allowPartial;
    const fileName = options?.fileName || 'contracts-import.csv';
    const operatorId = options?.operatorId;
    const defaultCustomerType = await this.getDefaultCustomerTypeForImport();
    const defaultSupplierType = this.getDefaultSupplierTypeForAutoCreate();
    const customerIdByName = new Map<string, string>();
    const supplierIdByName = new Map<string, string>();
    const contractTypeCodeByLookup = new Map(prepared.contractTypeCodeByLookup);
    const contractTypeSortOrderState = {
      next: await this.getNextContractTypeSortOrderForImport(),
    };

    if (prepared.errors.length > 0 && !allowPartial) {
      await this.saveImportLog({
        fileName,
        total: prepared.total,
        success: 0,
        failed: prepared.errors.length,
        allowPartial: false,
        errors: prepared.errors,
        operatorId,
      });
      throw new BadRequestException({
        message: `导入校验失败：共 ${prepared.total} 行，异常 ${prepared.errors.length} 行。请先修复错误，或开启“忽略错误并仅导入有效行”。`,
        details: {
          errors: prepared.errors.slice(0, 20),
        },
      });
    }

    const result: ImportContractResult = {
      total: prepared.total,
      success: 0,
      failed: prepared.errors.length,
      errors: [...prepared.errors],
    };

    for (const row of prepared.validRows) {
      try {
        const contractTypeCode = await this.ensureContractTypeForImport(
          row.contractTypeText,
          row.contractData.contractType,
          contractTypeCodeByLookup,
          contractTypeSortOrderState,
        );
        const isSalesContractType = await this.isSalesByContractType({
          contractTypeCode,
          contractTypeText: row.contractTypeText,
        });
        const customerId = await this.ensureCustomerForImport(
          row.customerName,
          customerIdByName,
          defaultCustomerType,
          operatorId,
          { visibleInCustomerList: isSalesContractType },
        );
        await this.syncCounterpartyByContractType({
          contractTypeCode,
          contractTypeText: row.contractTypeText,
          counterpartyName: row.customerName,
          supplierIdByName,
          defaultSupplierType,
          isSalesContractType,
        });
        const existingContract = await this.prisma.contract.findUnique({
          where: { contractNo: row.contractData.contractNo },
          select: {
            id: true,
            name: true,
            customerId: true,
            signingEntity: true,
            contractType: true,
            amountWithTax: true,
            amountWithoutTax: true,
            taxRate: true,
            signDate: true,
            endDate: true,
            isDeleted: true,
          },
        });

        if (existingContract) {
          const nextAmount = Number(row.contractData.amountWithTax);
          const nextSignDate = row.contractData.signDate;
          const nextEndDate = row.contractData.endDate || null;
          const updateData: Prisma.ContractUpdateInput = {};

          if (existingContract.name !== row.contractData.name) {
            updateData.name = row.contractData.name;
          }
          if (existingContract.customerId !== customerId) {
            updateData.customer = { connect: { id: customerId } };
          }
          if (existingContract.signingEntity !== row.contractData.signingEntity) {
            updateData.signingEntity = row.contractData.signingEntity;
          }
          if (existingContract.contractType !== contractTypeCode) {
            updateData.contractType = contractTypeCode;
          }
          if (Number(existingContract.amountWithTax) !== nextAmount) {
            updateData.amountWithTax = nextAmount;
          }
          if (Number(existingContract.amountWithoutTax) !== nextAmount) {
            updateData.amountWithoutTax = nextAmount;
          }
          if (Number(existingContract.taxRate ?? 0) !== 0) {
            updateData.taxRate = 0;
          }
          if (formatDateOnly(existingContract.signDate) !== nextSignDate) {
            updateData.signDate = new Date(nextSignDate);
          }
          if (formatDateOnly(existingContract.endDate) !== (nextEndDate || '')) {
            updateData.endDate = nextEndDate ? new Date(nextEndDate) : null;
          }
          if (existingContract.isDeleted) {
            updateData.isDeleted = false;
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.contract.update({
              where: { id: existingContract.id },
              data: updateData,
            });
          }
        } else {
          await this.create({
            ...row.contractData,
            contractType: contractTypeCode,
            customerId,
          } as CreateContractDto);
        }
        result.success += 1;
      } catch (error: unknown) {
        result.failed += 1;
        const message = error instanceof Error ? error.message : '导入失败';
        result.errors.push({ row: row.row, message });
      }
    }

    await this.saveImportLog({
      fileName,
      total: result.total,
      success: result.success,
      failed: result.failed,
      allowPartial,
      errors: result.errors,
      operatorId,
    });

    return result;
  }

  async getImportHistory(limit = 10, operatorId?: string): Promise<ImportHistoryItem[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const items = await this.prisma.contractImportLog.findMany({
      where: operatorId ? { operatorId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
      include: {
        operator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return items.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      total: item.total,
      success: item.success,
      failed: item.failed,
      allowPartial: item.allowPartial,
      errors: this.toImportErrors(item.errors),
      createdAt: item.createdAt,
      operator: item.operator,
    }));
  }

  async clearImportHistory(operatorId?: string) {
    const where = operatorId ? { operatorId } : {};
    return this.prisma.contractImportLog.deleteMany({ where });
  }

  async exportImportErrorCsv(id: string, operatorId?: string) {
    const log = await this.prisma.contractImportLog.findFirst({
      where: operatorId ? { id, operatorId } : { id },
      select: {
        id: true,
        fileName: true,
        errors: true,
      },
    });

    if (!log) {
      throw new NotFoundException('导入记录不存在');
    }

    const errors = this.toImportErrors(log.errors);
    if (!errors.length) {
      throw new BadRequestException('该导入记录没有错误数据');
    }

    return {
      fileName: `contracts-import-errors-${id}.csv`,
      csv: toCsv(
        ['行号', '错误信息'],
        errors.map((item) => [item.row, item.message]),
      ),
    };
  }

  async exportImportErrorExcel(id: string, operatorId?: string) {
    const log = await this.prisma.contractImportLog.findFirst({
      where: operatorId ? { id, operatorId } : { id },
      select: {
        id: true,
        errors: true,
      },
    });

    if (!log) {
      throw new NotFoundException('导入记录不存在');
    }

    const errors = this.toImportErrors(log.errors);
    if (!errors.length) {
      throw new BadRequestException('该导入记录没有错误数据');
    }

    return {
      fileName: `contracts-import-errors-${id}.xlsx`,
      buffer: toXlsxBuffer(
        ['行号', '错误信息'],
        errors.map((item) => [item.row, item.message]),
      ),
    };
  }

  /**
   * 获取合同详情
   */
  async findOne(id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id, isDeleted: false },
      include: {
        customer: true,
        paymentPlans: {
          orderBy: { period: 'asc' },
        },
        paymentRecords: {
          orderBy: { paymentDate: 'desc' },
        },
        invoices: {
          orderBy: { invoiceDate: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    // 计算汇总数据
    const totalPaid = contract.paymentRecords.reduce(
      (sum, record) => sum.plus(record.amount),
      new Decimal(0),
    );
    const totalInvoiced = contract.invoices
      .filter((inv) => inv.status === 'ISSUED')
      .reduce((sum, inv) => sum.plus(inv.amount), new Decimal(0));

    return {
      ...contract,
      attachmentName: this.normalizeAttachmentName(contract.attachmentName) || contract.attachmentName,
      summary: {
        totalPaid,
        receivable: new Decimal(contract.amountWithTax.toString()).minus(totalPaid),
        totalInvoiced,
        uninvoiced: totalPaid.minus(totalInvoiced),
        paymentProgress: totalPaid
          .div(contract.amountWithTax)
          .times(100)
          .toFixed(2),
      },
    };
  }

  /**
   * 创建合同
   */
  async create(createContractDto: CreateContractDto) {
    const normalizedContractNo = this.normalizeContractNo(createContractDto.contractNo);
    if (!normalizedContractNo) {
      throw new BadRequestException('合同编号不能为空');
    }

    const isSalesContractType = createContractDto.contractType
      ? await this.isSalesByContractType({ contractTypeCode: createContractDto.contractType })
      : true;

    // 验证对方签约主体是否存在。销售合同要求在客户列表可见，非销售允许隐藏客户（仅用于合同关联）。
    const customer = await this.prisma.customer.findFirst({
      where: isSalesContractType
        ? { id: createContractDto.customerId, isDeleted: false }
        : { id: createContractDto.customerId },
      select: { id: true, name: true, isDeleted: true },
    });
    if (!customer) {
      throw new BadRequestException('对方签约主体不存在');
    }

    if (isSalesContractType && customer.isDeleted) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: { isDeleted: false },
      });
    }

    if (createContractDto.contractType) {
      await this.syncCounterpartyByContractType({
        contractTypeCode: createContractDto.contractType,
        counterpartyName: customer.name,
        supplierIdByName: new Map<string, string>(),
        defaultSupplierType: this.getDefaultSupplierTypeForAutoCreate(),
        isSalesContractType,
      });
    }

    try {
      return await this.prisma.contract.create({
        data: {
          ...createContractDto,
          contractNo: normalizedContractNo,
          signDate: new Date(createContractDto.signDate),
          startDate: createContractDto.startDate ? new Date(createContractDto.startDate) : null,
          endDate: createContractDto.endDate ? new Date(createContractDto.endDate) : null,
        },
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error, 'contractNo')) {
        throw new ConflictException('合同编号已存在');
      }
      throw error;
    }
  }

  /**
   * 更新合同
   */
  async update(id: string, updateContractDto: UpdateContractDto, options?: { allowNonDraft?: boolean }) {
    const contract = await this.findOne(id);
    const allowNonDraft = !!options?.allowNonDraft;

    // 只有草稿状态可以编辑
    if (contract.status !== ContractStatus.DRAFT && !allowNonDraft) {
      throw new BadRequestException('只有草稿状态的合同可以编辑');
    }

    const normalizedContractNo =
      updateContractDto.contractNo !== undefined
        ? this.normalizeContractNo(updateContractDto.contractNo)
        : undefined;
    if (normalizedContractNo !== undefined && !normalizedContractNo) {
      throw new BadRequestException('合同编号不能为空');
    }

    const nextContractTypeCode = updateContractDto.contractType || contract.contractType || undefined;
    const isSalesContractType = nextContractTypeCode
      ? await this.isSalesByContractType({ contractTypeCode: nextContractTypeCode })
      : true;

    let resolvedCounterpartyName = contract.customer?.name || '';
    if (updateContractDto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: isSalesContractType
          ? { id: updateContractDto.customerId, isDeleted: false }
          : { id: updateContractDto.customerId },
        select: { id: true, name: true, isDeleted: true },
      });
      if (!customer) {
        throw new BadRequestException('对方签约主体不存在');
      }
      resolvedCounterpartyName = customer.name;

      if (isSalesContractType && customer.isDeleted) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { isDeleted: false },
        });
      }
    } else if (isSalesContractType && contract.customerId) {
      const currentCustomer = await this.prisma.customer.findFirst({
        where: { id: contract.customerId },
        select: { id: true, isDeleted: true },
      });
      if (currentCustomer?.isDeleted) {
        await this.prisma.customer.update({
          where: { id: currentCustomer.id },
          data: { isDeleted: false },
        });
      }
    }

    if (nextContractTypeCode) {
      await this.syncCounterpartyByContractType({
        contractTypeCode: nextContractTypeCode,
        counterpartyName: resolvedCounterpartyName,
        supplierIdByName: new Map<string, string>(),
        defaultSupplierType: this.getDefaultSupplierTypeForAutoCreate(),
        isSalesContractType,
      });
    }

    try {
      return await this.prisma.contract.update({
        where: { id },
        data: {
          ...updateContractDto,
          contractNo: normalizedContractNo,
          signDate: updateContractDto.signDate ? new Date(updateContractDto.signDate) : undefined,
          startDate: updateContractDto.startDate ? new Date(updateContractDto.startDate) : undefined,
          endDate: updateContractDto.endDate ? new Date(updateContractDto.endDate) : undefined,
        },
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error, 'contractNo')) {
        throw new ConflictException('合同编号已存在');
      }
      throw error;
    }
  }

  /**
   * 变更合同状态
   */
  async changeStatus(id: string, changeStatusDto: ChangeStatusDto) {
    const contract = await this.findOne(id);
    const { status } = changeStatusDto;

    // 状态流转校验
    const validTransitions: Record<string, string[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.EXECUTING],
      [ContractStatus.EXECUTING]: [ContractStatus.COMPLETED, ContractStatus.TERMINATED],
      [ContractStatus.COMPLETED]: [],
      [ContractStatus.TERMINATED]: [],
    };

    if (!validTransitions[contract.status]?.includes(status)) {
      throw new BadRequestException(
        `不能从 ${contract.status} 状态变更为 ${status} 状态`,
      );
    }

    return this.prisma.contract.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * 删除合同（软删除）
   */
  async remove(id: string, options?: { allowNonDraft?: boolean }) {
    const contract = await this.findOne(id);
    const allowNonDraft = !!options?.allowNonDraft;

    // 只有草稿状态可以删除
    if (contract.status !== ContractStatus.DRAFT && !allowNonDraft) {
      throw new BadRequestException('只有草稿状态的合同可以删除');
    }

    return this.prisma.contract.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  /**
   * 对账合同状态：根据回款金额在 EXECUTING/COMPLETED 之间自动同步
   */
  async reconcileContractStatus(contractId: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (
      !contract ||
      (contract.status !== ContractStatus.EXECUTING &&
        contract.status !== ContractStatus.COMPLETED)
    ) {
      return;
    }

    const totalPaid = await this.prisma.paymentRecord.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });

    const paidAmount = totalPaid._sum.amount || new Decimal(0);
    const nextStatus = paidAmount.gte(contract.amountWithTax)
      ? ContractStatus.COMPLETED
      : ContractStatus.EXECUTING;

    if (contract.status !== nextStatus) {
      await this.prisma.contract.update({
        where: { id: contractId },
        data: { status: nextStatus },
      });
    }
  }

  /**
   * 兼容旧调用
   */
  async checkAndCompleteContract(contractId: string) {
    return this.reconcileContractStatus(contractId);
  }
}
