// InfFinanceMs - 合同服务

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateContractDto } from "./dto/create-contract.dto";
import { UpdateContractDto } from "./dto/update-contract.dto";
import { QueryContractDto } from "./dto/query-contract.dto";
import { ChangeStatusDto } from "./dto/change-status.dto";
import { Decimal } from "@prisma/client/runtime/library";
import { ApprovalStatus, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { UploadService } from "../upload/upload.service";
import { toCsv, toXlsxBuffer } from "../../common/utils/tabular.utils";
import { generatePrefixedCode } from "../../common/utils/code-generator.utils";
import { isUniqueConflict } from "../../common/utils/prisma.utils";
import {
  ALLOWED_CONTRACT_SORT_FIELDS,
  CONTRACT_STATUS_LABELS,
  ContractStatus,
  IMPORT_CUSTOMER_REMARK_HIDDEN_NON_SALES,
  IMPORT_CUSTOMER_REMARK_VISIBLE,
} from "./contracts.constants";
import {
  normalizeContractAttachmentName,
  normalizeContractNo as normalizeContractNoText,
  normalizeContractNoKey as normalizeContractNoLookupKey,
  resolveContractAttachmentMimeType,
} from "./contracts.attachment.utils";
import {
  resolveBatchAttachmentErrorMessage,
  resolveContractByAttachmentFileName,
} from "./contracts.attachment.bind.utils";
import {
  buildImportPreviewSamples,
  prepareContractImportRowsByDeps,
} from "./contracts.import.prepare.utils";
import {
  buildImportErrorCsvExport,
  buildImportErrorExcelExport,
  resolveContractImportErrors,
} from "./contracts.import.error-export.utils";
import {
  ensureImportCustomerByDeps,
  ensureImportSupplierByDeps,
} from "./contracts.import.counterparty.utils";
import { resolveDefaultSupplierTypeForAutoCreate } from "./contracts.import.defaults.utils";
import {
  createImportExecutionContextByDeps,
  resolveDefaultCustomerTypeInContextByDeps,
} from "./contracts.import.context.utils";
import {
  resolveContractTypeHintsByCodeByDeps,
  resolveIsSalesByContractTypeByDeps,
  syncCounterpartyByContractTypeByDeps,
} from "./contracts.counterparty.sync.utils";
import { ensureImportContractTypeByDeps } from "./contracts.import.contract-type.utils";
import {
  createImportRowHandlersByDeps,
  processImportRowWithHandlers,
} from "./contracts.import.execute.utils";
import {
  attachContractPaymentSummary,
  buildContractExportQuery,
  buildContractExportRows,
  buildContractListQueryContext,
  buildContractListResponse,
  buildContractPaymentMap,
  CONTRACT_EXPORT_HEADERS,
  CONTRACT_IMPORT_TEMPLATE_HEADERS,
  CONTRACT_IMPORT_TEMPLATE_ROWS,
} from "./contracts.list.utils";
import { buildContractDetailSummary } from "./contracts.summary.utils";
import { runImportCsvFlowByDeps } from "./contracts.import.flow.utils";
import { createImportContractUpsertHandlerByPrismaDeps } from "./contracts.import.persistence.utils";
import {
  clampImportHistoryLimit,
  mapImportLogToHistoryItem,
} from "./contracts.import.history.utils";
import { buildContractImportLogCreateData } from "./contracts.import.log.utils";
import { buildContractTypeCandidateCodes } from "./contracts.type.utils";
import {
  buildCreateContractPersistData,
  buildUpdateContractPersistData,
  ensureDraftOnlyForAction,
  ensureValidStatusTransition,
  normalizeOptionalContractNo,
  normalizeRequiredContractNo,
  resolveCreateCounterpartyContextByDeps,
  resolveUpdateCounterpartyContextByDeps,
  syncCounterpartyForContractMutationByDeps,
} from "./contracts.mutation.utils";
import type {
  BatchBindContractAttachmentsResult,
  ContractAttachmentTarget,
  ImportContractResult,
  ImportCsvOptions,
  ImportExecutionContext,
  ImportHistoryItem,
  ImportPreviewResult,
  PreparedImportResult,
} from "./contracts.import.types";

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private uploadService: UploadService,
  ) {}

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
      throw new NotFoundException("合同不存在");
    }

    if (!contract.attachmentUrl) {
      throw new BadRequestException("该合同暂无附件");
    }

    const fullPath = this.uploadService.getFilePath(contract.attachmentUrl);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException("附件不存在或已被删除");
    }

    const filenameRaw =
      contract.attachmentName?.trim() ||
      path.basename(fullPath) ||
      `${contract.contractNo}-附件`;
    const filename =
      normalizeContractAttachmentName(filenameRaw) || filenameRaw;

    return {
      filename,
      mimeType: resolveContractAttachmentMimeType(filename),
      buffer: fs.readFileSync(fullPath),
    };
  }

  async getAttachmentPreviewPayload(id: string) {
    const payload = await this.getAttachmentDownloadPayload(id);
    if (payload.mimeType !== "application/pdf") {
      throw new BadRequestException("当前附件不是 PDF，暂不支持在线预览");
    }
    return payload;
  }

  private normalizeContractNo(value?: string): string {
    return normalizeContractNoText(value);
  }

  async batchBindAttachments(
    files: Express.Multer.File[],
    options?: { allowOverwrite?: boolean },
  ): Promise<BatchBindContractAttachmentsResult> {
    if (!files?.length) {
      throw new BadRequestException("请至少上传一个附件文件");
    }

    const allowOverwrite = options?.allowOverwrite !== false;
    const contracts = await this.prisma.contract.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        contractNo: true,
        attachmentUrl: true,
      },
    });

    const targets: ContractAttachmentTarget[] = contracts
      .map((item) => ({
        id: item.id,
        contractNo: item.contractNo,
        normalizedContractNo: normalizeContractNoLookupKey(item.contractNo),
        attachmentUrl: item.attachmentUrl,
      }))
      .filter((item) => !!item.normalizedContractNo);

    if (targets.length === 0) {
      throw new BadRequestException("系统内暂无可绑定附件的合同");
    }

    const result: BatchBindContractAttachmentsResult = {
      total: files.length,
      success: 0,
      failed: 0,
      items: [],
      errors: [],
    };

    const processedContractIds = new Set<string>();

    for (const file of files) {
      const displayFileName =
        normalizeContractAttachmentName(file.originalname) ||
        file.originalname ||
        "未命名文件";

      try {
        const resolved = resolveContractByAttachmentFileName(
          displayFileName,
          targets,
        );
        if (!resolved.target) {
          throw new BadRequestException(resolved.error || "无法匹配合同编号");
        }

        const target = resolved.target;
        if (processedContractIds.has(target.id)) {
          throw new BadRequestException(
            `同一批次中合同 ${target.contractNo} 仅支持绑定一个附件`,
          );
        }

        if (!allowOverwrite && target.attachmentUrl) {
          throw new BadRequestException(
            `合同 ${target.contractNo} 已存在附件，请开启覆盖后重试`,
          );
        }

        const uploaded = await this.uploadService.saveFile(file, "contracts");
        await this.prisma.contract.update({
          where: { id: target.id },
          data: {
            attachmentUrl: uploaded.url,
            attachmentName: uploaded.originalName || displayFileName,
          },
        });

        processedContractIds.add(target.id);
        result.success += 1;
        result.items.push({
          fileName: displayFileName,
          contractId: target.id,
          contractNo: target.contractNo,
          attachmentName: uploaded.originalName || displayFileName,
        });
      } catch (error: unknown) {
        result.failed += 1;
        result.errors.push({
          fileName: displayFileName,
          message: resolveBatchAttachmentErrorMessage(error),
        });
      }
    }

    return result;
  }

  private async generateCustomerCodeForImport(): Promise<string> {
    return generatePrefixedCode({
      model: this.prisma.customer,
      field: "code",
      prefix: "CUS",
      sequenceRegex: /^CUS(\d{6})$/,
      sequenceLength: 6,
    });
  }

  private async generateAutoContractTypeCodeForImport(): Promise<string> {
    const prefix = "AUTO_CT_";
    const lastType = await this.prisma.dictionary.findFirst({
      where: {
        type: "CONTRACT_TYPE",
        code: {
          startsWith: prefix,
        },
      },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let sequence = 1;
    if (lastType?.code) {
      const match = lastType.code.match(/^AUTO_CT_(\d{6})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return `${prefix}${String(sequence).padStart(6, "0")}`;
  }

  private async generateSupplierCodeForAutoCreate(): Promise<string> {
    return generatePrefixedCode({
      model: this.prisma.supplier,
      field: "code",
      prefix: "SUP",
      sequenceRegex: /^SUP(\d{6})$/,
      sequenceLength: 6,
    });
  }

  private async getNextContractTypeSortOrderForImport(): Promise<number> {
    const lastType = await this.prisma.dictionary.findFirst({
      where: { type: "CONTRACT_TYPE" },
      orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
      select: { sortOrder: true },
    });
    return (lastType?.sortOrder || 0) + 1;
  }

  private isUniqueConflict(error: unknown, field: string): boolean {
    return isUniqueConflict(error, field);
  }

  private async ensureCustomerForImport(
    customerName: string,
    customerIdByName: Map<string, string>,
    defaultCustomerType: string,
    operatorId?: string,
    options?: { visibleInCustomerList?: boolean },
  ): Promise<string> {
    const visibleInCustomerList = options?.visibleInCustomerList !== false;
    return ensureImportCustomerByDeps({
      customerName,
      customerIdByName,
      visibleInCustomerList,
      findVisibleCustomer: (name: string) =>
        this.prisma.customer.findFirst({
          where: { name, isDeleted: false },
          select: { id: true },
        }),
      findHiddenCustomer: (name: string) =>
        this.prisma.customer.findFirst({
          where: { name, isDeleted: true },
          select: { id: true },
        }),
      restoreHiddenCustomer: async (customerId: string) => {
        await this.prisma.customer.update({
          where: { id: customerId },
          data: { isDeleted: false },
        });
      },
      generateCode: () => this.generateCustomerCodeForImport(),
      createWithCode: (code: string) =>
        this.prisma.customer.create({
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
        }),
      isCodeConflict: (error: unknown) => isUniqueConflict(error, "code"),
      exhaustedErrorMessage: `自动创建客户失败: ${customerName}`,
      maxRetries: 8,
    });
  }

  private async ensureSupplierForCounterparty(
    supplierName: string,
    supplierIdByName: Map<string, string>,
    defaultSupplierType: string,
  ): Promise<string> {
    return ensureImportSupplierByDeps({
      supplierName,
      supplierIdByName,
      findVisibleSupplier: (name: string) =>
        this.prisma.supplier.findFirst({
          where: { name, isDeleted: false },
          select: { id: true },
        }),
      generateCode: () => this.generateSupplierCodeForAutoCreate(),
      createWithCode: (code: string) =>
        this.prisma.supplier.create({
          data: {
            code,
            name: supplierName,
            type: defaultSupplierType,
            remark: "由合同自动同步创建，待完善供应商信息",
          },
          select: { id: true },
        }),
      isCodeConflict: (error: unknown) => isUniqueConflict(error, "code"),
      exhaustedErrorMessage: `自动创建供应商失败: ${supplierName}`,
      maxRetries: 8,
    });
  }

  private async resolveContractTypeHintsByCode(
    contractTypeCode?: string,
  ): Promise<string[]> {
    return resolveContractTypeHintsByCodeByDeps({
      contractTypeCode,
      findContractTypeByCode: (code: string) =>
        this.prisma.dictionary.findFirst({
          where: {
            type: "CONTRACT_TYPE",
            code: { equals: code, mode: Prisma.QueryMode.insensitive },
          },
          select: { name: true, value: true },
        }),
    });
  }

  private async isSalesByContractType(args: {
    contractTypeCode?: string;
    contractTypeText?: string;
  }): Promise<boolean> {
    return resolveIsSalesByContractTypeByDeps({
      contractTypeCode: args.contractTypeCode,
      contractTypeText: args.contractTypeText,
      resolveHintsByCode: (contractTypeCode?: string) =>
        this.resolveContractTypeHintsByCode(contractTypeCode),
    });
  }

  private async syncCounterpartyByContractType(args: {
    contractTypeCode?: string;
    contractTypeText?: string;
    counterpartyName?: string;
    supplierIdByName: Map<string, string>;
    defaultSupplierType: string;
    isSalesContractType?: boolean;
  }) {
    await syncCounterpartyByContractTypeByDeps({
      contractTypeCode: args.contractTypeCode,
      contractTypeText: args.contractTypeText,
      counterpartyName: args.counterpartyName,
      supplierIdByName: args.supplierIdByName,
      defaultSupplierType: args.defaultSupplierType,
      isSalesContractType: args.isSalesContractType,
      resolveIsSalesContractType: (params) =>
        this.isSalesByContractType({
          contractTypeCode: params.contractTypeCode,
          contractTypeText: params.contractTypeText,
        }),
      ensureSupplierForCounterparty: (
        supplierName: string,
        supplierIdByName: Map<string, string>,
        defaultSupplierType: string,
      ) =>
        this.ensureSupplierForCounterparty(
          supplierName,
          supplierIdByName,
          defaultSupplierType,
        ),
    });
  }

  private async ensureContractTypeForImport(
    contractTypeText: string,
    resolvedContractTypeCode: string | undefined,
    contractTypeCodeByLookup: Map<string, string>,
    sortOrderState: { next: number },
  ): Promise<string> {
    return ensureImportContractTypeByDeps({
      contractTypeText,
      resolvedContractTypeCode,
      contractTypeCodeByLookup,
      sortOrderState,
      findExistingByText: (normalizedContractTypeText: string) =>
        this.prisma.dictionary.findFirst({
          where: {
            type: "CONTRACT_TYPE",
            OR: [
              {
                code: {
                  equals: normalizedContractTypeText,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                name: {
                  equals: normalizedContractTypeText,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                value: {
                  equals: normalizedContractTypeText,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          },
          select: { code: true, name: true, value: true },
        }),
      createByCode: ({
        code,
        normalizedContractTypeText,
        sortOrder,
      }: {
        code: string;
        normalizedContractTypeText: string;
        sortOrder: number;
      }) =>
        this.prisma.dictionary.create({
          data: {
            type: "CONTRACT_TYPE",
            code,
            name: normalizedContractTypeText,
            value: normalizedContractTypeText,
            color: "default",
            sortOrder,
            isDefault: false,
            isEnabled: true,
            remark: "由合同导入自动创建",
          },
          select: { code: true, name: true, value: true },
        }),
      buildCandidateCodes: (normalizedContractTypeText: string) =>
        buildContractTypeCandidateCodes({
          normalizedContractTypeText,
          generateAutoCode: () => this.generateAutoContractTypeCodeForImport(),
          autoRetryCount: 8,
        }),
      isCodeConflict: (error: unknown) => isUniqueConflict(error, "code"),
    });
  }

  /**
   * 获取合同列表
   */
  async findAll(query: QueryContractDto) {
    const { page, pageSize, skip, safeSortBy, sortOrder, where } =
      buildContractListQueryContext({
        query,
        allowedSortFields: ALLOWED_CONTRACT_SORT_FIELDS,
        defaultSortBy: "createdAt",
      });

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

    const contractIds = items.map((item) => item.id);
    const paymentSums = contractIds.length
      ? await this.prisma.paymentRecord.groupBy({
          by: ["contractId"],
          where: { contractId: { in: contractIds } },
          _sum: { amount: true },
        })
      : [];
    const paymentMap = buildContractPaymentMap(paymentSums);
    const itemsWithPayment = attachContractPaymentSummary(items, paymentMap);

    return buildContractListResponse({
      items: itemsWithPayment,
      total,
      page,
      pageSize,
    });
  }

  /**
   * 导出合同列表 CSV
   */
  async exportCsv(query: QueryContractDto) {
    const data = await this.findAll(buildContractExportQuery(query));

    const rows = buildContractExportRows(data.items, CONTRACT_STATUS_LABELS);

    return toCsv([...CONTRACT_EXPORT_HEADERS], rows);
  }

  /**
   * 导出合同列表 Excel
   */
  async exportExcel(query: QueryContractDto): Promise<Buffer> {
    const data = await this.findAll(buildContractExportQuery(query));

    const rows = buildContractExportRows(data.items, CONTRACT_STATUS_LABELS);

    return toXlsxBuffer([...CONTRACT_EXPORT_HEADERS], rows);
  }

  /**
   * 下载合同导入模板（Excel）
   */
  getImportTemplateExcel(): Buffer {
    return toXlsxBuffer(
      [...CONTRACT_IMPORT_TEMPLATE_HEADERS],
      CONTRACT_IMPORT_TEMPLATE_ROWS,
    );
  }

  private async prepareImportRows(
    fileBuffer: Buffer,
    fileName?: string,
  ): Promise<PreparedImportResult> {
    return prepareContractImportRowsByDeps({
      fileBuffer,
      fileName,
      findContractTypes: () =>
        this.prisma.dictionary.findMany({
          where: { type: "CONTRACT_TYPE" },
          select: { code: true, name: true, value: true },
        }),
      normalizeContractNo: (value) => this.normalizeContractNo(value),
      defaultSigningEntity: "InfFinanceMs",
    });
  }

  async previewImportCsv(
    fileBuffer: Buffer,
    fileName?: string,
  ): Promise<ImportPreviewResult> {
    const prepared = await this.prepareImportRows(fileBuffer, fileName);
    return {
      total: prepared.total,
      valid: prepared.validRows.length,
      invalid: prepared.errors.length,
      errors: prepared.errors,
      samples: buildImportPreviewSamples(prepared.validRows, 5),
    };
  }

  private async createImportExecutionContext(
    prepared: PreparedImportResult,
    options?: ImportCsvOptions,
  ): Promise<ImportExecutionContext> {
    const defaultCustomerType = await resolveDefaultCustomerTypeInContextByDeps(
      {
        findPreferred: () =>
          this.prisma.dictionary.findFirst({
            where: {
              type: "CUSTOMER_TYPE",
              isEnabled: true,
              isDefault: true,
            },
            select: { code: true },
          }),
        findFallback: () =>
          this.prisma.dictionary.findFirst({
            where: {
              type: "CUSTOMER_TYPE",
              isEnabled: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: { code: true },
          }),
        defaultCode: "ENTERPRISE",
      },
    );

    return createImportExecutionContextByDeps({
      prepared,
      options,
      defaultCustomerType,
      nextContractTypeSortOrder:
        await this.getNextContractTypeSortOrderForImport(),
      defaultFileName: "contracts-import.csv",
      defaultSupplierType: resolveDefaultSupplierTypeForAutoCreate(),
    });
  }

  /**
   * 批量导入合同（CSV）
   */
  async importCsv(
    fileBuffer: Buffer,
    options?: ImportCsvOptions,
  ): Promise<ImportContractResult> {
    const prepared = await this.prepareImportRows(
      fileBuffer,
      options?.fileName,
    );
    const context = await this.createImportExecutionContext(prepared, options);
    const upsertImportedContract =
      createImportContractUpsertHandlerByPrismaDeps({
        prisma: this.prisma,
        createContract: (dto) => this.create(dto),
      });

    const handlers = createImportRowHandlersByDeps({
      ensureContractTypeForImport: this.ensureContractTypeForImport.bind(this),
      resolveIsSalesByContractType: this.isSalesByContractType.bind(this),
      ensureCustomerForImport: this.ensureCustomerForImport.bind(this),
      syncCounterpartyByContractType:
        this.syncCounterpartyByContractType.bind(this),
      upsertImportedContract,
    });

    return runImportCsvFlowByDeps({
      prepared,
      context,
      processRow: (row) => processImportRowWithHandlers(row, context, handlers),
      saveImportLog: (args) =>
        this.prisma.contractImportLog.create({
          data: buildContractImportLogCreateData(args),
        }),
    });
  }

  async getImportHistory(
    limit = 10,
    operatorId?: string,
  ): Promise<ImportHistoryItem[]> {
    const safeLimit = clampImportHistoryLimit(limit);
    const items = await this.prisma.contractImportLog.findMany({
      where: operatorId ? { operatorId } : undefined,
      orderBy: { createdAt: "desc" },
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

    return items.map((item) => mapImportLogToHistoryItem(item));
  }

  async clearImportHistory(operatorId?: string) {
    const where = operatorId ? { operatorId } : {};
    return this.prisma.contractImportLog.deleteMany({ where });
  }

  private async getImportErrorsByLogId(id: string, operatorId?: string) {
    const log = await this.prisma.contractImportLog.findFirst({
      where: operatorId ? { id, operatorId } : { id },
      select: {
        id: true,
        fileName: true,
        errors: true,
      },
    });

    if (!log) {
      throw new NotFoundException("导入记录不存在");
    }

    const errors = resolveContractImportErrors(log.errors);
    if (!errors.length) {
      throw new BadRequestException("该导入记录没有错误数据");
    }
    return errors;
  }

  async exportImportErrorCsv(id: string, operatorId?: string) {
    const errors = await this.getImportErrorsByLogId(id, operatorId);
    return buildImportErrorCsvExport(id, errors);
  }

  async exportImportErrorExcel(id: string, operatorId?: string) {
    const errors = await this.getImportErrorsByLogId(id, operatorId);
    return buildImportErrorExcelExport(id, errors);
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
          orderBy: { period: "asc" },
        },
        paymentRecords: {
          orderBy: { paymentDate: "desc" },
        },
        invoices: {
          orderBy: { invoiceDate: "desc" },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException("合同不存在");
    }

    return {
      ...contract,
      attachmentName:
        normalizeContractAttachmentName(contract.attachmentName) ||
        contract.attachmentName,
      summary: buildContractDetailSummary(contract),
    };
  }

  /**
   * 创建合同
   */
  async create(createContractDto: CreateContractDto) {
    const normalizedContractNo = normalizeRequiredContractNo({
      contractNo: createContractDto.contractNo,
      normalize: (value?: string) => this.normalizeContractNo(value),
    });

    const { isSalesContractType, counterpartyName } =
      await resolveCreateCounterpartyContextByDeps({
        customerId: createContractDto.customerId,
        contractTypeCode: createContractDto.contractType,
        resolveIsSalesContractType: (contractTypeCode: string) =>
          this.isSalesByContractType({ contractTypeCode }),
        findCustomer: (customerId: string, salesOnlyVisible: boolean) =>
          this.prisma.customer.findFirst({
            where: salesOnlyVisible
              ? { id: customerId, isDeleted: false }
              : { id: customerId },
            select: { id: true, name: true, isDeleted: true },
          }),
        restoreCustomerVisibility: async (customerId: string) => {
          await this.prisma.customer.update({
            where: { id: customerId },
            data: { isDeleted: false },
          });
        },
      });

    await syncCounterpartyForContractMutationByDeps({
      contractTypeCode: createContractDto.contractType,
      counterpartyName,
      isSalesContractType,
      defaultSupplierType: resolveDefaultSupplierTypeForAutoCreate(),
      syncCounterpartyByContractType: (syncArgs) =>
        this.syncCounterpartyByContractType(syncArgs),
    });

    try {
      return await this.prisma.contract.create({
        data: buildCreateContractPersistData(
          createContractDto,
          normalizedContractNo,
        ),
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (error) {
      if (isUniqueConflict(error, "contractNo")) {
        throw new ConflictException("合同编号已存在");
      }
      throw error;
    }
  }

  /**
   * 更新合同
   */
  async update(
    id: string,
    updateContractDto: UpdateContractDto,
    options?: { allowNonDraft?: boolean },
  ) {
    const contract = await this.findOne(id);
    const allowNonDraft = !!options?.allowNonDraft;

    ensureDraftOnlyForAction({
      status: contract.status,
      allowNonDraft,
      actionText: "编辑",
      draftStatus: ContractStatus.DRAFT,
    });

    const normalizedContractNo = normalizeOptionalContractNo({
      contractNo: updateContractDto.contractNo,
      normalize: (value?: string) => this.normalizeContractNo(value),
    });

    const nextContractTypeCode =
      updateContractDto.contractType || contract.contractType || undefined;

    const { isSalesContractType, counterpartyName } =
      await resolveUpdateCounterpartyContextByDeps({
        nextCustomerId: updateContractDto.customerId,
        currentCustomerId: contract.customerId,
        currentCounterpartyName: contract.customer?.name || "",
        contractTypeCode: nextContractTypeCode,
        resolveIsSalesContractType: (contractTypeCode: string) =>
          this.isSalesByContractType({ contractTypeCode }),
        findCustomer: (customerId: string, salesOnlyVisible: boolean) =>
          this.prisma.customer.findFirst({
            where: salesOnlyVisible
              ? { id: customerId, isDeleted: false }
              : { id: customerId },
            select: { id: true, name: true, isDeleted: true },
          }),
        findCurrentCustomerVisibility: (customerId: string) =>
          this.prisma.customer.findFirst({
            where: { id: customerId },
            select: { id: true, isDeleted: true },
          }),
        restoreCustomerVisibility: async (customerId: string) => {
          await this.prisma.customer.update({
            where: { id: customerId },
            data: { isDeleted: false },
          });
        },
      });

    await syncCounterpartyForContractMutationByDeps({
      contractTypeCode: nextContractTypeCode,
      counterpartyName,
      isSalesContractType,
      defaultSupplierType: resolveDefaultSupplierTypeForAutoCreate(),
      syncCounterpartyByContractType: (syncArgs) =>
        this.syncCounterpartyByContractType(syncArgs),
    });

    try {
      return await this.prisma.contract.update({
        where: { id },
        data: buildUpdateContractPersistData(
          updateContractDto,
          normalizedContractNo,
        ),
        include: {
          customer: {
            select: { id: true, name: true, code: true },
          },
        },
      });
    } catch (error) {
      if (isUniqueConflict(error, "contractNo")) {
        throw new ConflictException("合同编号已存在");
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

    const validTransitions: Record<string, string[]> = {
      [ContractStatus.DRAFT]: [ContractStatus.EXECUTING],
      [ContractStatus.EXECUTING]: [
        ContractStatus.COMPLETED,
        ContractStatus.TERMINATED,
      ],
      [ContractStatus.COMPLETED]: [],
      [ContractStatus.TERMINATED]: [],
    };

    ensureValidStatusTransition({
      currentStatus: contract.status,
      nextStatus: status,
      statusTransitions: validTransitions,
    });

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

    ensureDraftOnlyForAction({
      status: contract.status,
      allowNonDraft,
      actionText: "删除",
      draftStatus: ContractStatus.DRAFT,
    });

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
