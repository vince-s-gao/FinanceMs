// InfFinanceMs - 发票服务

import { Injectable, NotFoundException, BadRequestException, HttpException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { Decimal } from '@prisma/client/runtime/library';
import * as fs from 'fs';
import * as path from 'path';
import { parseDateRangeEnd, parseDateRangeStart, resolveSortField } from '../../common/utils/query.utils';
import {
  getFileExtension,
  normalizeText,
  parseTabularBuffer,
  resolveHeaderIndex,
} from '../../common/utils/tabular.utils';
import { UploadService } from '../upload/upload.service';
import { PDFParse } from 'pdf-parse';

// 发票状态常量
const InvoiceStatus = {
  ISSUED: 'ISSUED',
  VOIDED: 'VOIDED',
} as const;

const ALLOWED_INVOICE_SORT_FIELDS = [
  'invoiceNo',
  'invoiceType',
  'amount',
  'invoiceDate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

const INVOICE_TYPE_VALUES = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT'] as const;
type InvoiceTypeValue = (typeof INVOICE_TYPE_VALUES)[number];
type InvoiceDirectionValue = 'INBOUND' | 'OUTBOUND';
const MAX_REASONABLE_INVOICE_AMOUNT = 1_000_000_000; // 10亿，超过该值通常为误识别（如发票号码串）

const IMPORT_HEADER_ALIASES = {
  contractId: ['合同ID', '合同id', 'contractId', 'contract_id'],
  contractNo: ['合同编号', 'contractNo', 'contract_no'],
  invoiceNo: ['发票号码', '发票号', 'invoiceNo', 'invoice_no'],
  invoiceType: ['发票类型', 'invoiceType', 'invoice_type'],
  amount: ['发票金额', '金额', 'amount'],
  taxAmount: ['税额', 'taxAmount', 'tax_amount'],
  invoiceDate: ['开票日期', '发票日期', 'invoiceDate', 'invoice_date', 'date'],
} as const;

interface InvoiceImportErrorItem {
  row: number;
  fileName: string;
  message: string;
}

interface ParsedInvoiceCandidate {
  row: number;
  fileName: string;
  contractId?: string;
  contractNo?: string;
  invoiceNo: string;
  invoiceType: InvoiceTypeValue;
  amount: number;
  taxAmount?: number;
  invoiceDate: string;
  sourceFile?: Express.Multer.File;
}

interface PreparedInvoiceImportData {
  total: number;
  validRows: ParsedInvoiceCandidate[];
  errors: InvoiceImportErrorItem[];
}

interface DirectionCheckContext {
  expectedDirection?: InvoiceDirectionValue;
  normalizedSalesSet?: Set<string>;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

  private normalizeErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const payload = error.getResponse() as any;
      if (payload?.code === 'INVOICE_AMOUNT_EXCEEDS_CONTRACT' && payload?.details) {
        const details = payload.details as {
          contractNo?: string;
          contractAmountWithTax?: string;
          issuedAmount?: string;
          currentInvoiceAmount?: string;
          totalAfterImport?: string;
          overflowAmount?: string;
        };
        return [
          payload?.message || '开票金额超出合同金额',
          `合同(${details.contractNo || '-'})含税金额 ${details.contractAmountWithTax || '-'}，`,
          `已开票 ${details.issuedAmount || '-'}，`,
          `本次 ${details.currentInvoiceAmount || '-'}，`,
          `导入后 ${details.totalAfterImport || '-'}，`,
          `超出 ${details.overflowAmount || '-'}`,
        ].join('');
      }
      const raw = payload?.message;
      if (Array.isArray(raw)) return raw.join('; ');
      if (typeof raw === 'string') return raw;
      return error.message || '请求失败';
    }
    if (error instanceof Error) return error.message;
    return '请求失败';
  }

  private isSalesContractType(values: string[]): boolean {
    for (const value of values) {
      const normalized = normalizeText(value || '').toUpperCase();
      if (!normalized) continue;
      if (normalized.includes('SALES') || value.includes('销售')) {
        return true;
      }
    }
    return false;
  }

  private async getSalesContractTypeCodes(): Promise<string[]> {
    const fallback = ['SALES'];
    const rows = await this.prisma.dictionary.findMany({
      where: {
        type: 'CONTRACT_TYPE',
      },
      select: {
        code: true,
        name: true,
        value: true,
      },
    });

    const codes = rows
      .filter((row) => this.isSalesContractType([row.code, row.name || '', row.value || '']))
      .map((row) => row.code)
      .filter((code) => !!normalizeText(code));

    const merged = [...new Set([...codes, ...fallback])];
    return merged.length > 0 ? merged : fallback;
  }

  private resolveDirectionByContractType(
    contractType: string | null | undefined,
    salesContractTypeCodeSet: Set<string>,
  ): InvoiceDirectionValue {
    const normalized = normalizeText(contractType || '').toUpperCase();
    if (!normalized) return 'INBOUND';
    return salesContractTypeCodeSet.has(normalized) ? 'OUTBOUND' : 'INBOUND';
  }

  private directionLabel(direction: InvoiceDirectionValue): string {
    return direction === 'OUTBOUND' ? '出项发票' : '进项发票';
  }

  private assertDirectionMatches(
    actualDirection: InvoiceDirectionValue,
    expectedDirection: InvoiceDirectionValue | undefined,
    scene: string,
  ) {
    if (!expectedDirection) return;
    if (actualDirection === expectedDirection) return;
    throw new BadRequestException(
      `${scene}与当前模块不匹配：期望 ${this.directionLabel(expectedDirection)}，实际为 ${this.directionLabel(actualDirection)}`,
    );
  }

  private filenameScore(value: string): number {
    const cjkCount = (value.match(/[\u4e00-\u9fff]/g) || []).length;
    const replacementCount = (value.match(/\uFFFD/g) || []).length;
    const mojibakeHintCount = (value.match(/[ÃÂ]/g) || []).length;
    return cjkCount * 3 - replacementCount * 4 - mojibakeHintCount * 2;
  }

  private normalizeOriginalFileName(originalName: string): string {
    const baseName = normalizeText(originalName || '').trim() || 'file';
    const decoded = Buffer.from(baseName, 'latin1').toString('utf8').trim();
    if (!decoded) return baseName;
    return this.filenameScore(decoded) > this.filenameScore(baseName)
      ? decoded.normalize('NFC')
      : baseName;
  }

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
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeByExt[ext] || 'application/octet-stream';
  }

  async getAttachmentDownloadPayload(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: {
        invoiceNo: true,
        attachmentUrl: true,
        attachmentName: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('发票不存在');
    }

    if (!invoice.attachmentUrl) {
      throw new BadRequestException('该发票暂无附件');
    }

    const fullPath = this.uploadService.getFilePath(invoice.attachmentUrl);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('附件不存在或已被删除');
    }

    const filenameRaw =
      invoice.attachmentName?.trim()
      || path.basename(fullPath)
      || `${invoice.invoiceNo}-附件`;
    const filename = this.normalizeOriginalFileName(filenameRaw) || filenameRaw;

    return {
      filename,
      mimeType: this.resolveAttachmentMimeType(filename),
      buffer: fs.readFileSync(fullPath),
    };
  }

  private parseNumber(raw: string): number | null {
    const value = normalizeText(raw || '').replace(/[,\s，]/g, '');
    if (!value) return null;
    const num = Number(value.replace(/[¥￥元]/g, ''));
    if (!Number.isFinite(num)) return null;
    return num;
  }

  private toReasonableAmount(raw: string): number | null {
    const parsed = this.parseNumber(raw);
    if (parsed === null) return null;
    if (parsed < 0.01 || parsed > MAX_REASONABLE_INVOICE_AMOUNT) return null;
    return parsed;
  }

  private normalizeDate(value: string): string | null {
    const raw = normalizeText(value || '');
    if (!raw) return null;

    if (/^\d{8}$/.test(raw)) {
      const y = raw.slice(0, 4);
      const m = raw.slice(4, 6);
      const d = raw.slice(6, 8);
      const normalized = `${y}-${m}-${d}`;
      const date = new Date(normalized);
      if (!Number.isNaN(date.getTime())) return normalized;
      return null;
    }

    const normalized = raw
      .replace(/[年/.]/g, '-')
      .replace(/月/g, '-')
      .replace(/日/g, '')
      .replace(/\s+/g, '')
      .replace(/--+/g, '-');

    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private resolveInvoiceType(value: string): InvoiceTypeValue | null {
    const raw = normalizeText(value || '').toUpperCase();
    if (!raw) return null;

    if (raw === 'VAT_SPECIAL' || raw.includes('专票') || raw.includes('增值税专用')) {
      return 'VAT_SPECIAL';
    }
    if (raw === 'VAT_NORMAL' || raw.includes('普票') || raw.includes('增值税普通')) {
      return 'VAT_NORMAL';
    }
    if (raw === 'RECEIPT' || raw.includes('收据')) {
      return 'RECEIPT';
    }
    if (raw === '专用发票' || raw === '专用') return 'VAT_SPECIAL';
    if (raw === '普通发票' || raw === '普通') return 'VAT_NORMAL';
    return null;
  }

  private looksLikeDateNumber(text: string): boolean {
    if (!/^\d{8}$/.test(text)) return false;
    const year = Number(text.slice(0, 4));
    const month = Number(text.slice(4, 6));
    const day = Number(text.slice(6, 8));
    return year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
  }

  private extractInvoiceNo(text: string): string | null {
    const keywordMatches = [
      /(?:发票(?:号码|号)?|INVOICE(?:\s*NO|\s*NUMBER)?|NO\.?|编号)\s*[:：#-]?\s*([A-Z0-9]{6,30})/i,
    ];
    for (const pattern of keywordMatches) {
      const hit = text.match(pattern);
      if (hit?.[1]) {
        return hit[1].trim().toUpperCase();
      }
    }

    const numberTokens = text.match(/\b\d{8,20}\b/g) || [];
    for (const token of numberTokens) {
      if (!this.looksLikeDateNumber(token)) {
        return token;
      }
    }

    const alphaNumTokens = text.match(/\b[A-Za-z0-9-]{8,30}\b/g) || [];
    for (const token of alphaNumTokens) {
      if (/\d/.test(token)) {
        return token.toUpperCase();
      }
    }

    return null;
  }

  private extractAmount(text: string): number | null {
    const candidates: number[] = [];

    const normalizedText = normalizeText(text || '');

    const keywordPatterns = [
      /(?:价税合计(?:（?小写）?)?|小写)\s*[:：]?\s*(?:¥|￥)\s*([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/gi,
      /(?:合计金额|发票金额|金额合计)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/gi,
      /(?:金额|AMOUNT)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/gi,
    ];

    for (const pattern of keywordPatterns) {
      let match: RegExpExecArray | null = pattern.exec(normalizedText);
      while (match) {
        const parsed = this.toReasonableAmount(match[1]);
        if (parsed !== null) candidates.push(parsed);
        match = pattern.exec(normalizedText);
      }
    }

    if (candidates.length > 0) {
      return Math.max(...candidates);
    }

    const currencyPattern = /(?:¥|￥)\s*([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/g;
    let match: RegExpExecArray | null = currencyPattern.exec(normalizedText);
    while (match) {
      const parsed = this.toReasonableAmount(match[1]);
      if (parsed !== null) candidates.push(parsed);
      match = currencyPattern.exec(normalizedText);
    }

    if (candidates.length > 0) {
      return Math.max(...candidates);
    }

    // OCR / PDF 文本布局异常时，金额关键词与数值可能被打散；此时回退到“小数金额集合取最大值”。
    const decimalTokens = normalizedText.match(/\b([0-9]{1,12}\.[0-9]{1,2})\b/g) || [];
    const decimalCandidates = decimalTokens
      .map((token) => this.toReasonableAmount(token))
      .filter((num): num is number => num !== null);
    if (decimalCandidates.length > 0) {
      return Math.max(...decimalCandidates);
    }

    return candidates.length > 0 ? Math.max(...candidates) : null;
  }

  private extractAmountFromFileName(fileNameWithoutExt: string): number | null {
    const text = normalizeText(fileNameWithoutExt || '');
    if (!text) return null;

    // 明确金额语义优先
    const semanticPatterns = [
      /(?:金额|价税合计|合计|应付|应收|房租|租金|费用)\D{0,8}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
      /([0-9][0-9,]*(?:\.[0-9]{1,2})?)\D{0,8}(?:元|金额|房租|租金|费用)/i,
    ];
    for (const pattern of semanticPatterns) {
      const hit = text.match(pattern);
      if (hit?.[1]) {
        const parsed = this.parseNumber(hit[1]);
        if (parsed !== null && parsed >= 10 && parsed <= 100000000) {
          return parsed;
        }
      }
    }

    // 文件名数字兜底：仅使用文件名，不使用 PDF 原文，避免把内部结构数字误识别成金额
    const numericTokens = text.match(/\d{1,10}(?:\.\d{1,2})?/g) || [];
    const candidates = numericTokens
      .filter((token) => !this.looksLikeDateNumber(token))
      .map((token) => Number(token))
      .filter(
        (num) =>
          Number.isFinite(num) &&
          num >= 10 &&
          num <= 1000000 && // 文件名兜底金额限制更保守
          !(Number.isInteger(num) && num >= 1900 && num <= 2100), // 排除年份
      );

    if (candidates.length === 0) return null;
    return Math.max(...candidates);
  }

  private extractTaxAmount(text: string): number | null {
    const normalizedText = normalizeText(text || '');
    const patterns = [
      /(?:税额|税金|TAX)\s*[:：]?\s*[¥￥]?\s*([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i,
      /(?:税额|税金|TAX)\D{0,8}([0-9]{1,3}(?:[,，][0-9]{3})*(?:\.[0-9]{1,2})|[0-9]+(?:\.[0-9]{1,2}))/i,
    ];

    for (const pattern of patterns) {
      const hit = normalizedText.match(pattern);
      if (!hit?.[1]) continue;
      const parsed = this.toReasonableAmount(hit[1]);
      if (parsed !== null) return parsed;
    }
    return null;
  }

  private inferTaxAmountFromAmountBreakdown(text: string, totalAmount: number): number | null {
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) return null;
    const normalizedText = normalizeText(text || '');
    const decimalTokens = normalizedText.match(/\b([0-9]{1,12}\.[0-9]{1,2})\b/g) || [];
    const numbers = [
      ...new Set(
        decimalTokens
          .map((token) => this.parseNumber(token))
          .filter(
            (num): num is number =>
              num !== null && num > 0 && num < totalAmount && num <= 100000000,
          ),
      ),
    ];

    if (numbers.length < 2) return null;

    let inferred: number | null = null;
    for (let i = 0; i < numbers.length; i += 1) {
      for (let j = i + 1; j < numbers.length; j += 1) {
        const a = numbers[i];
        const b = numbers[j];
        if (Math.abs(a + b - totalAmount) > 0.05) continue;
        const candidate = Math.min(a, b);
        if (candidate <= totalAmount * 0.5) {
          inferred = inferred === null ? candidate : Math.max(inferred, candidate);
        }
      }
    }

    return inferred;
  }

  private extractInvoiceDate(text: string): string | null {
    const keywordPattern = /(?:开票日期|发票日期|日期|DATE)\s*[:：]?\s*((?:19|20)\d{2}[年\-/.]\d{1,2}[月\-/.]\d{1,2}日?)/i;
    const keywordHit = text.match(keywordPattern);
    if (keywordHit?.[1]) {
      return this.normalizeDate(keywordHit[1]);
    }

    const generalPattern = /((?:19|20)\d{2}[年\-/.]\d{1,2}[月\-/.]\d{1,2}日?|\b(?:19|20)\d{6}\b)/;
    const generalHit = text.match(generalPattern);
    if (generalHit?.[1]) {
      return this.normalizeDate(generalHit[1]);
    }

    return null;
  }

  private extractContractNo(text: string): string | null {
    const hit = text.match(/(?:合同(?:编号|号)?|CONTRACT(?:\s*NO)?)\s*[:：#-]?\s*([A-Z0-9-_\/]{4,64})/i);
    if (!hit?.[1]) return null;
    return hit[1].toUpperCase();
  }

  private sanitizeExtractedText(text: string): string {
    return normalizeText(text || '')
      .replace(/[^\x20-\x7E\u4e00-\u9fa5]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200000);
  }

  private looksLikePdf(buffer: Buffer): boolean {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }

  private async extractTextFromPdf(file: Express.Multer.File, normalizedFileName: string): Promise<string> {
    if (!this.looksLikePdf(file.buffer)) {
      return '';
    }

    let parser: PDFParse | null = null;
    try {
      parser = new PDFParse({ data: file.buffer });
      const result = await parser.getText();
      return this.sanitizeExtractedText(result?.text || '');
    } catch (error) {
      this.logger.warn(
        `[发票解析] PDF 文本提取失败（${normalizedFileName}）：${this.normalizeErrorMessage(error)}`,
      );
      return '';
    } finally {
      if (parser) {
        try {
          await parser.destroy();
        } catch {
          // ignore parser destroy errors
        }
      }
    }
  }

  private async extractAttachmentText(
    file: Express.Multer.File,
    normalizedFileName: string,
  ): Promise<string> {
    const extension = getFileExtension(normalizedFileName);
    if (extension === '.pdf') {
      return this.extractTextFromPdf(file, normalizedFileName);
    }

    // 非结构化二进制（图片/Word）不再做盲解析，避免误命中元数据数字。
    if (file.mimetype?.startsWith('text/')) {
      return this.sanitizeExtractedText(file.buffer.toString('utf8'));
    }
    return '';
  }

  private async parseAttachmentFile(
    file: Express.Multer.File,
    row: number,
    defaultContractId?: string,
  ): Promise<{ candidate?: ParsedInvoiceCandidate; error?: InvoiceImportErrorItem }> {
    const normalizedFileName = this.normalizeOriginalFileName(file.originalname);
    const baseName = normalizeText(normalizedFileName.replace(/\.[^.]+$/, ''));
    const extractedText = await this.extractAttachmentText(file, normalizedFileName);
    const contentText = normalizeText(extractedText).toUpperCase();
    const contextText = normalizeText(`${baseName} ${extractedText}`.trim()).toUpperCase();

    // 以正文识别优先，文件名仅兜底，避免文件名中的长数字（发票号、时间戳）污染金额识别。
    const invoiceNo = this.extractInvoiceNo(contentText) || this.extractInvoiceNo(contextText);
    const invoiceType = this.resolveInvoiceType(contentText) || this.resolveInvoiceType(contextText) || 'VAT_NORMAL';
    const amount = this.extractAmount(contentText) ?? this.extractAmountFromFileName(baseName);
    const extractedTaxAmount = this.extractTaxAmount(contentText);
    const taxAmount =
      extractedTaxAmount !== null && extractedTaxAmount > 0
        ? extractedTaxAmount
        : this.inferTaxAmountFromAmountBreakdown(contentText, amount ?? 0);
    const invoiceDate = this.extractInvoiceDate(contentText) || this.extractInvoiceDate(contextText);
    const contractNo = this.extractContractNo(contentText) || this.extractContractNo(contextText);

    if (!invoiceNo) {
      return {
        error: {
          row,
          fileName: normalizedFileName,
          message: '无法识别发票号码，请在文件名中包含“发票号码”或可识别编号',
        },
      };
    }
    if (amount === null || amount < 0.01) {
      return {
        error: {
          row,
          fileName: normalizedFileName,
          message: '无法识别有效金额（需 >= 0.01）',
        },
      };
    }
    if (!invoiceDate) {
      return {
        error: {
          row,
          fileName: normalizedFileName,
          message: '无法识别开票日期（支持 YYYY-MM-DD / YYYYMMDD）',
        },
      };
    }
    if (!defaultContractId && !contractNo) {
      return {
        error: {
          row,
          fileName: normalizedFileName,
          message: '缺少关联合同：请先选择合同，或在文件中提供合同编号',
        },
      };
    }

    return {
      candidate: {
        row,
        fileName: normalizedFileName,
        contractId: defaultContractId,
        contractNo: contractNo || undefined,
        invoiceNo,
        invoiceType,
        amount,
        taxAmount: taxAmount === null ? undefined : taxAmount,
        invoiceDate,
        sourceFile: file,
      },
    };
  }

  private parseTabularFile(
    file: Express.Multer.File,
    defaultContractId?: string,
  ): { rows: ParsedInvoiceCandidate[]; errors: InvoiceImportErrorItem[]; total: number } {
    const normalizedFileName = this.normalizeOriginalFileName(file.originalname);
    const table = parseTabularBuffer(file.buffer, normalizedFileName);
    if (table.length < 2) {
      return {
        rows: [],
        errors: [{ row: 1, fileName: normalizedFileName, message: '表格内容为空或缺少数据行' }],
        total: Math.max(table.length - 1, 0),
      };
    }

    const headers = table[0];
    const invoiceNoIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.invoiceNo);
    const invoiceTypeIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.invoiceType);
    const amountIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.amount);
    const taxAmountIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.taxAmount);
    const invoiceDateIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.invoiceDate);
    const contractIdIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.contractId);
    const contractNoIdx = resolveHeaderIndex(headers, IMPORT_HEADER_ALIASES.contractNo);

    const missing: string[] = [];
    if (invoiceNoIdx === undefined) missing.push('发票号码/invoice_no');
    if (amountIdx === undefined) missing.push('发票金额/amount');
    if (invoiceDateIdx === undefined) missing.push('开票日期/invoice_date');
    if (!defaultContractId && contractIdIdx === undefined && contractNoIdx === undefined) {
      missing.push('合同ID/合同编号（或在上传前选择默认合同）');
    }
    if (missing.length > 0) {
      return {
        rows: [],
        errors: [{ row: 1, fileName: normalizedFileName, message: `导入文件缺少必要字段: ${missing.join('、')}` }],
        total: table.length - 1,
      };
    }

    const errors: InvoiceImportErrorItem[] = [];
    const rows: ParsedInvoiceCandidate[] = [];
    for (let i = 1; i < table.length; i += 1) {
      const rowNumber = i + 1;
      const cells = table[i];
      const get = (idx?: number) => normalizeText(idx === undefined ? '' : String(cells[idx] || ''));

      const invoiceNo = get(invoiceNoIdx).toUpperCase();
      const invoiceType = this.resolveInvoiceType(get(invoiceTypeIdx)) || 'VAT_NORMAL';
      const amount = this.parseNumber(get(amountIdx));
      const taxAmount = this.parseNumber(get(taxAmountIdx));
      const invoiceDate = this.normalizeDate(get(invoiceDateIdx));
      const contractId = get(contractIdIdx) || defaultContractId;
      const contractNo = get(contractNoIdx).toUpperCase();

      if (!invoiceNo) {
        errors.push({ row: rowNumber, fileName: normalizedFileName, message: '发票号码不能为空' });
        continue;
      }
      if (amount === null || amount < 0.01) {
        errors.push({ row: rowNumber, fileName: normalizedFileName, message: '发票金额无效（需 >= 0.01）' });
        continue;
      }
      if (!invoiceDate) {
        errors.push({ row: rowNumber, fileName: normalizedFileName, message: '开票日期格式无效' });
        continue;
      }
      if (!contractId && !contractNo) {
        errors.push({
          row: rowNumber,
          fileName: normalizedFileName,
          message: '缺少关联合同：请填写合同ID/合同编号，或在上传前选择默认合同',
        });
        continue;
      }

      rows.push({
        row: rowNumber,
        fileName: normalizedFileName,
        contractId: contractId || undefined,
        contractNo: contractNo || undefined,
        invoiceNo,
        invoiceType,
        amount,
        taxAmount: taxAmount === null ? undefined : taxAmount,
        invoiceDate,
      });
    }
    return {
      rows,
      errors,
      total: table.length - 1,
    };
  }

  private async prepareImportData(
    files: Express.Multer.File[],
    defaultContractId?: string,
    expectedDirection?: InvoiceDirectionValue,
  ): Promise<PreparedInvoiceImportData> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请至少上传一个发票文件');
    }

    if (defaultContractId) {
      const salesContractTypeCodes = expectedDirection ? await this.getSalesContractTypeCodes() : [];
      const normalizedSalesSet = new Set(
        salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
      );
      const contract = await this.prisma.contract.findFirst({
        where: { id: defaultContractId, isDeleted: false },
        select: { id: true, contractType: true, contractNo: true },
      });
      if (!contract) {
        throw new NotFoundException('所选关联合同不存在');
      }
      const actualDirection = this.resolveDirectionByContractType(contract.contractType, normalizedSalesSet);
      this.assertDirectionMatches(actualDirection, expectedDirection, `合同 ${contract.contractNo || contract.id}`);
    }

    const errors: InvoiceImportErrorItem[] = [];
    const validRows: ParsedInvoiceCandidate[] = [];
    let attachmentRow = 0;
    let total = 0;

    for (const file of files) {
      const extension = getFileExtension(file.originalname);
      const isTabular = extension === '.csv' || extension === '.xlsx' || extension === '.xls';
      if (isTabular) {
        const parsed = this.parseTabularFile(file, defaultContractId);
        total += parsed.total;
        errors.push(...parsed.errors);
        validRows.push(...parsed.rows);
        continue;
      }

      attachmentRow += 1;
      total += 1;
      const parsed = await this.parseAttachmentFile(file, attachmentRow, defaultContractId);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      if (parsed.candidate) {
        validRows.push(parsed.candidate);
      }
    }

    const seenInvoiceNos = new Set<string>();
    const dedupedRows: ParsedInvoiceCandidate[] = [];
    for (const row of validRows) {
      const normalizedNo = row.invoiceNo.toUpperCase();
      if (seenInvoiceNos.has(normalizedNo)) {
        errors.push({
          row: row.row,
          fileName: row.fileName,
          message: `发票号码重复：${row.invoiceNo}`,
        });
        continue;
      }
      seenInvoiceNos.add(normalizedNo);
      dedupedRows.push(row);
    }

    return {
      total,
      validRows: dedupedRows,
      errors,
    };
  }

  private async resolveContractId(
    row: ParsedInvoiceCandidate,
    contractCacheById: Map<string, { id: string; direction: InvoiceDirectionValue }>,
    contractCacheByNo: Map<string, { id: string; direction: InvoiceDirectionValue }>,
    directionCheckContext?: DirectionCheckContext,
  ): Promise<string> {
    const expectedDirection = directionCheckContext?.expectedDirection;
    const normalizedSalesSet = directionCheckContext?.normalizedSalesSet || new Set<string>();

    if (row.contractId) {
      const cached = contractCacheById.get(row.contractId);
      if (cached) {
        this.assertDirectionMatches(cached.direction, expectedDirection, `第 ${row.row} 行关联合同`);
        return cached.id;
      }
      const contract = await this.prisma.contract.findFirst({
        where: { id: row.contractId, isDeleted: false },
        select: { id: true, contractNo: true, contractType: true },
      });
      if (!contract) {
        throw new NotFoundException(`第 ${row.row} 行合同不存在（ID: ${row.contractId}）`);
      }
      const direction = this.resolveDirectionByContractType(contract.contractType, normalizedSalesSet);
      this.assertDirectionMatches(direction, expectedDirection, `第 ${row.row} 行合同 ${contract.contractNo || contract.id}`);
      const cacheItem = { id: contract.id, direction };
      contractCacheById.set(contract.id, cacheItem);
      return contract.id;
    }

    const contractNo = normalizeText(row.contractNo || '').toUpperCase();
    if (!contractNo) {
      throw new BadRequestException(`第 ${row.row} 行缺少关联合同`);
    }
    const cached = contractCacheByNo.get(contractNo);
    if (cached) {
      this.assertDirectionMatches(cached.direction, expectedDirection, `第 ${row.row} 行合同 ${contractNo}`);
      return cached.id;
    }
    const contract = await this.prisma.contract.findFirst({
      where: { contractNo, isDeleted: false },
      select: { id: true, contractNo: true, contractType: true },
    });
    if (!contract) {
      throw new NotFoundException(`第 ${row.row} 行合同编号不存在（${contractNo}）`);
    }
    const direction = this.resolveDirectionByContractType(contract.contractType, normalizedSalesSet);
    this.assertDirectionMatches(direction, expectedDirection, `第 ${row.row} 行合同 ${contractNo}`);
    const cacheItem = { id: contract.id, direction };
    contractCacheByNo.set(contractNo, cacheItem);
    contractCacheById.set(contract.id, cacheItem);
    return contract.id;
  }

  async previewImportFiles(
    files: Express.Multer.File[],
    defaultContractId?: string,
    expectedDirection?: InvoiceDirectionValue,
  ) {
    const prepared = await this.prepareImportData(files, defaultContractId, expectedDirection);
    const contractCacheById = new Map<string, { id: string; direction: InvoiceDirectionValue }>();
    const contractCacheByNo = new Map<string, { id: string; direction: InvoiceDirectionValue }>();
    const confirmedRows: ParsedInvoiceCandidate[] = [];
    const errors = [...prepared.errors];
    const salesContractTypeCodes = expectedDirection ? await this.getSalesContractTypeCodes() : [];
    const normalizedSalesSet = new Set(
      salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
    );

    for (const row of prepared.validRows) {
      try {
        await this.resolveContractId(row, contractCacheById, contractCacheByNo, {
          expectedDirection,
          normalizedSalesSet,
        });
        confirmedRows.push(row);
      } catch (error) {
        errors.push({
          row: row.row,
          fileName: row.fileName,
          message: this.normalizeErrorMessage(error),
        });
      }
    }

    return {
      total: prepared.total,
      valid: confirmedRows.length,
      invalid: errors.length,
      errors,
      samples: confirmedRows.slice(0, 20).map((row) => ({
        row: row.row,
        fileName: row.fileName,
        contractNo: row.contractNo || '-',
        invoiceNo: row.invoiceNo,
        invoiceType: row.invoiceType,
        amount: row.amount,
        taxAmount: row.taxAmount ?? null,
        invoiceDate: row.invoiceDate,
      })),
    };
  }

  async importFiles(
    files: Express.Multer.File[],
    options?: { allowPartial?: boolean; contractId?: string; expectedDirection?: InvoiceDirectionValue },
  ) {
    const expectedDirection = options?.expectedDirection;
    const prepared = await this.prepareImportData(files, options?.contractId, expectedDirection);
    const allowPartial = !!options?.allowPartial;
    const contractCacheById = new Map<string, { id: string; direction: InvoiceDirectionValue }>();
    const contractCacheByNo = new Map<string, { id: string; direction: InvoiceDirectionValue }>();
    const errors = [...prepared.errors];
    const importQueue: Array<ParsedInvoiceCandidate & { resolvedContractId: string }> = [];
    const salesContractTypeCodes = expectedDirection ? await this.getSalesContractTypeCodes() : [];
    const normalizedSalesSet = new Set(
      salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
    );

    for (const row of prepared.validRows) {
      try {
        const resolvedContractId = await this.resolveContractId(row, contractCacheById, contractCacheByNo, {
          expectedDirection,
          normalizedSalesSet,
        });
        importQueue.push({
          ...row,
          resolvedContractId,
        });
      } catch (error) {
        errors.push({
          row: row.row,
          fileName: row.fileName,
          message: this.normalizeErrorMessage(error),
        });
      }
    }

    if (errors.length > 0 && !allowPartial) {
      throw new BadRequestException({
        message: `导入校验失败：共 ${prepared.total} 条，异常 ${errors.length} 条。请修复后重试，或开启“忽略错误并仅导入有效行”。`,
        details: { errors: errors.slice(0, 50) },
      });
    }

    let success = 0;
    for (const row of importQueue) {
      let uploadResult: { url: string; filename: string; originalName: string } | null = null;
      try {
        if (row.sourceFile) {
          uploadResult = await this.uploadService.saveFile(row.sourceFile, 'invoices');
        }
        await this.create({
          contractId: row.resolvedContractId,
          invoiceNo: row.invoiceNo,
          invoiceType: row.invoiceType,
          amount: row.amount,
          taxAmount: row.taxAmount,
          invoiceDate: row.invoiceDate,
          attachmentUrl: uploadResult?.url,
          attachmentName: uploadResult?.originalName || uploadResult?.filename,
          expectedDirection,
        });
        success += 1;
      } catch (error) {
        if (uploadResult?.url) {
          try {
            await this.uploadService.deleteFile(uploadResult.url);
          } catch {
            // ignore attachment rollback errors
          }
        }
        errors.push({
          row: row.row,
          fileName: row.fileName,
          message: this.normalizeErrorMessage(error),
        });
      }
    }

    return {
      total: prepared.total,
      success,
      failed: errors.length,
      errors,
    };
  }

  /**
   * 获取发票列表
   */
  async findAll(query: QueryInvoiceDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      contractId,
      invoiceType,
      status,
      direction,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_INVOICE_SORT_FIELDS, 'createdAt');

    const where: any = {};

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { invoiceNo: { contains: keyword, mode: 'insensitive' } },
        { contract: { contractNo: { contains: keyword, mode: 'insensitive' } } },
        { contract: { name: { contains: keyword, mode: 'insensitive' } } },
      ];
    }

    // 合同筛选
    if (contractId) {
      where.contractId = contractId;
    }

    // 发票类型筛选
    if (invoiceType) {
      where.invoiceType = invoiceType;
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 发票方向筛选（基于合同类型）
    const salesContractTypeCodes = await this.getSalesContractTypeCodes();
    const normalizedSalesSet = new Set(
      salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
    );
    if (direction === 'OUTBOUND') {
      where.contract = {
        ...(where.contract || {}),
        contractType: {
          in: salesContractTypeCodes,
        },
      };
    } else if (direction === 'INBOUND') {
      where.contract = {
        ...(where.contract || {}),
        OR: [
          { contractType: null },
          {
            contractType: {
              notIn: salesContractTypeCodes,
            },
          },
        ],
      };
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.invoiceDate = {};
      if (startDate) where.invoiceDate.gte = parseDateRangeStart(startDate);
      if (endDate) where.invoiceDate.lte = parseDateRangeEnd(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true,
              name: true,
              contractType: true,
              customer: {
                select: { id: true, name: true },
              },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const itemsWithDirection = items.map((item: any) => ({
      ...item,
      direction: this.resolveDirectionByContractType(item.contract?.contractType, normalizedSalesSet),
    }));

    return {
      items: itemsWithDirection,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取发票详情
   */
  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        contract: {
          include: {
            customer: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('发票不存在');
    }

    return invoice;
  }

  /**
   * 创建发票
   */
  async create(createInvoiceDto: CreateInvoiceDto) {
    const {
      contractId,
      invoiceNo,
      invoiceType,
      amount,
      taxAmount,
      invoiceDate,
      attachmentUrl,
      attachmentName,
      expectedDirection,
    } = createInvoiceDto;

    // 验证合同
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    if (expectedDirection) {
      const salesContractTypeCodes = await this.getSalesContractTypeCodes();
      const normalizedSalesSet = new Set(
        salesContractTypeCodes.map((item) => normalizeText(item).toUpperCase()),
      );
      const actualDirection = this.resolveDirectionByContractType(contract.contractType, normalizedSalesSet);
      this.assertDirectionMatches(actualDirection, expectedDirection, `合同 ${contract.contractNo}`);
    }

    // 检查发票号是否重复
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { invoiceNo },
    });
    if (existingInvoice) {
      throw new BadRequestException('发票号码已存在');
    }

    // 检查开票金额是否超出合同金额
    const totalInvoiced = await this.prisma.invoice.aggregate({
      where: { contractId, status: InvoiceStatus.ISSUED },
      _sum: { amount: true },
    });
    const invoicedAmount = totalInvoiced._sum.amount || new Decimal(0);
    const newTotalInvoiced = invoicedAmount.plus(amount);

    if (newTotalInvoiced.gt(contract.amountWithTax)) {
      const contractTotal = new Decimal(contract.amountWithTax.toString());
      const overflow = newTotalInvoiced.minus(contractTotal);
      throw new BadRequestException({
        code: 'INVOICE_AMOUNT_EXCEEDS_CONTRACT',
        message: '开票金额超出合同金额',
        details: {
          contractNo: contract.contractNo,
          contractAmountWithTax: contractTotal.toFixed(2),
          issuedAmount: invoicedAmount.toFixed(2),
          currentInvoiceAmount: new Decimal(amount).toFixed(2),
          totalAfterImport: newTotalInvoiced.toFixed(2),
          overflowAmount: overflow.toFixed(2),
        },
      });
    }

    return this.prisma.invoice.create({
      data: {
        contractId,
        invoiceNo,
        invoiceType,
        amount,
        taxAmount,
        invoiceDate: new Date(invoiceDate),
        attachmentUrl,
        attachmentName,
      },
      include: {
        contract: {
          select: { id: true, contractNo: true, name: true },
        },
      },
    });
  }

  /**
   * 作废发票
   */
  async void(id: string) {
    const invoice = await this.findOne(id);

    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new BadRequestException('发票已作废');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.VOIDED },
    });
  }

  /**
   * 删除发票
   */
  async remove(id: string) {
    const invoice = await this.findOne(id);

    const deleted = await this.prisma.invoice.delete({
      where: { id },
    });

    if (invoice.attachmentUrl) {
      try {
        await this.uploadService.deleteFile(invoice.attachmentUrl);
      } catch (error) {
        this.logger.warn(`发票附件删除失败(${invoice.attachmentUrl}): ${(error as Error)?.message || error}`);
      }
    }

    return deleted;
  }

  /**
   * 获取合同的开票风险预警
   */
  async getInvoiceRisk(contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, isDeleted: false },
    });
    if (!contract) {
      throw new NotFoundException('合同不存在');
    }

    // 计算已回款金额
    const totalPaid = await this.prisma.paymentRecord.aggregate({
      where: { contractId },
      _sum: { amount: true },
    });
    const paidAmount = totalPaid._sum.amount || new Decimal(0);

    // 计算已开票金额
    const totalInvoiced = await this.prisma.invoice.aggregate({
      where: { contractId, status: InvoiceStatus.ISSUED },
      _sum: { amount: true },
    });
    const invoicedAmount = totalInvoiced._sum.amount || new Decimal(0);

    // 未开票金额 = 已回款 - 已开票
    const uninvoicedAmount = paidAmount.minus(invoicedAmount);

    return {
      contractId,
      paidAmount,
      invoicedAmount,
      uninvoicedAmount,
      hasRisk: uninvoicedAmount.gt(0),
      riskMessage: uninvoicedAmount.gt(0)
        ? `存在未开票风险，差额：${uninvoicedAmount.toFixed(2)}元`
        : null,
    };
  }
}
