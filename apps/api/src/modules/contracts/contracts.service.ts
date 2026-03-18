// InfFinanceMs - 合同服务

import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';

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

// 生成合同编号
function generateContractNo(date: Date, sequence: number): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `HT${year}${month}-${String(sequence).padStart(4, '0')}`;
}

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
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
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
  dto: CreateContractDto;
};

const IMPORT_HEADER_ALIASES = {
  name: ['合同名称', 'name', 'contract_name', 'contractname'],
  customerName: ['客户名称', 'customer_name', 'customername', 'customer'],
  signingEntity: ['公司签约主体', '签约主体', 'signing_entity', 'signingentity', 'company'],
  contractType: ['合同类型', 'contract_type', 'contracttype', 'type'],
  amount: ['合同金额', '金额', 'contract_amount', 'contractamount', 'amount'],
  signDate: ['签署日期', '签订日期', 'sign_date', 'signdate'],
  endDate: ['结束日期', '到期日期', 'end_date', 'enddate'],
} as const;

function normalizeHeader(value: string): string {
  return normalizeText(value).toLowerCase().replace(/[\s_\-]/g, '');
}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成合同编号
   */
  private async generateContractNo(now: Date): Promise<string> {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `HT${year}${month}-`;
    const lastContract = await this.prisma.contract.findFirst({
      where: {
        contractNo: {
          startsWith: prefix,
        },
      },
      orderBy: { contractNo: 'desc' },
      select: { contractNo: true },
    });

    let sequence = 1;
    if (lastContract?.contractNo) {
      const match = lastContract.contractNo.match(/-(\d{4})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return generateContractNo(now, sequence);
  }

  private isContractNoConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes('contractNo');
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

  private async prepareImportRows(fileBuffer: Buffer): Promise<{
    total: number;
    validRows: PreparedImportRow[];
    errors: Array<{ row: number; message: string }>;
  }> {
    const content = fileBuffer.toString('utf-8');
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV 内容为空或缺少数据行');
    }

    const headers = parseCsvLine(lines[0]);
    const indexByHeader = headers.reduce<Record<string, number>>((acc, header, index) => {
      acc[normalizeHeader(header)] = index;
      return acc;
    }, {});

    const resolveHeaderIndex = (aliases: readonly string[]) => {
      for (const alias of aliases) {
        const idx = indexByHeader[normalizeHeader(alias)];
        if (idx !== undefined) return idx;
      }
      return undefined;
    };

    const nameIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.name);
    const customerNameIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.customerName);
    const signingEntityIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.signingEntity);
    const contractTypeIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.contractType);
    const amountIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.amount);
    const signDateIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.signDate);
    const endDateIdx = resolveHeaderIndex(IMPORT_HEADER_ALIASES.endDate);

    const missingHeaders: string[] = [];
    if (nameIdx === undefined) missingHeaders.push('合同名称/name');
    if (customerNameIdx === undefined) missingHeaders.push('客户名称/customer_name');
    if (signingEntityIdx === undefined) missingHeaders.push('公司签约主体/signing_entity');
    if (contractTypeIdx === undefined) missingHeaders.push('合同类型/contract_type');
    if (amountIdx === undefined) missingHeaders.push('合同金额/amount');
    if (signDateIdx === undefined) missingHeaders.push('签署日期/sign_date');
    if (missingHeaders.length > 0) {
      throw new BadRequestException(`CSV 缺少必要字段: ${missingHeaders.join('、')}`);
    }

    const contractTypes = await this.prisma.dictionary.findMany({
      where: { type: 'CONTRACT_TYPE', isEnabled: true },
      select: { code: true, name: true },
    });
    const contractTypeCodeByText = new Map<string, string>();
    contractTypes.forEach((type) => {
      contractTypeCodeByText.set(type.code, type.code);
      contractTypeCodeByText.set(type.name, type.code);
    });

    const customers = await this.prisma.customer.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true },
    });
    const customerIdByName = new Map<string, string>();
    customers.forEach((item) => customerIdByName.set(item.name, item.id));

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: PreparedImportRow[] = [];

    for (let i = 1; i < lines.length; i += 1) {
      const rowNumber = i + 1;
      const cells = parseCsvLine(lines[i]);
      const getByIndex = (idx?: number) => normalizeText(idx === undefined ? '' : cells[idx] || '');

      const name = getByIndex(nameIdx);
      const customerName = getByIndex(customerNameIdx);
      const signingEntity = getByIndex(signingEntityIdx) || 'InfFinanceMs';
      const contractTypeRaw = getByIndex(contractTypeIdx);
      const amount = toNumber(getByIndex(amountIdx));
      const signDate = toDateString(getByIndex(signDateIdx));
      const endDate = toDateString(getByIndex(endDateIdx));

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

      const customerId = customerIdByName.get(customerName);
      if (!customerId) {
        errors.push({ row: rowNumber, message: `未找到客户: ${customerName}` });
        continue;
      }

      const contractType = contractTypeCodeByText.get(contractTypeRaw);
      if (!contractType) {
        errors.push({ row: rowNumber, message: `合同类型无效: ${contractTypeRaw}` });
        continue;
      }

      validRows.push({
        row: rowNumber,
        customerName,
        contractTypeText: contractTypeRaw,
        dto: {
          name,
          customerId,
          signingEntity,
          contractType,
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
      total: lines.length - 1,
      validRows,
      errors,
    };
  }

  async previewImportCsv(fileBuffer: Buffer): Promise<ImportPreviewResult> {
    const prepared = await this.prepareImportRows(fileBuffer);
    return {
      total: prepared.total,
      valid: prepared.validRows.length,
      invalid: prepared.errors.length,
      errors: prepared.errors,
      samples: prepared.validRows.slice(0, 5).map((row) => ({
        row: row.row,
        name: row.dto.name,
        customerName: row.customerName,
        contractType: row.contractTypeText,
        amount: Number(row.dto.amountWithTax),
        signDate: row.dto.signDate,
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
    const prepared = await this.prepareImportRows(fileBuffer);
    const allowPartial = !!options?.allowPartial;
    const fileName = options?.fileName || 'contracts-import.csv';
    const operatorId = options?.operatorId;

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
        await this.create(row.dto);
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
    // 验证客户是否存在
    const customer = await this.prisma.customer.findFirst({
      where: { id: createContractDto.customerId, isDeleted: false },
    });
    if (!customer) {
      throw new BadRequestException('客户不存在');
    }

    // 并发下可能出现编号冲突，依赖唯一索引进行重试
    for (let i = 0; i < 8; i++) {
      const contractNo = await this.generateContractNo(new Date());
      try {
        return await this.prisma.contract.create({
          data: {
            ...createContractDto,
            contractNo,
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
        if (this.isContractNoConflict(error)) {
          if (i < 7) {
            continue;
          }
          break;
        }
        throw error;
      }
    }

    throw new ConflictException('合同编号生成失败，请重试');
  }

  /**
   * 更新合同
   */
  async update(id: string, updateContractDto: UpdateContractDto) {
    const contract = await this.findOne(id);

    // 只有草稿状态可以编辑
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException('只有草稿状态的合同可以编辑');
    }

    return this.prisma.contract.update({
      where: { id },
      data: {
        ...updateContractDto,
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
  async remove(id: string) {
    const contract = await this.findOne(id);

    // 只有草稿状态可以删除
    if (contract.status !== ContractStatus.DRAFT) {
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
