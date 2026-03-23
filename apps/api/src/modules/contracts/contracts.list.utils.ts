import type { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  normalizePagination,
  parseDateRangeEnd,
  parseDateRangeStart,
  resolveSortField,
} from "../../common/utils/query.utils";
import type { QueryContractDto } from "./dto/query-contract.dto";
import { formatDateOnly } from "./contracts.constants";

type ContractPaymentGroupByRow = {
  contractId: string;
  _sum: {
    amount: Decimal | null;
  };
};

type ContractListItem = {
  id: string;
  contractNo: string;
  name: string;
  customer?: { name?: string | null } | null;
  signingEntity?: string | null;
  contractType?: string | null;
  amountWithTax: Decimal | number | string;
  signDate: Date | string;
  endDate?: Date | string | null;
  status: string;
};

export function buildContractListWhere(
  query: Pick<
    QueryContractDto,
    | "keyword"
    | "customerKeyword"
    | "status"
    | "customerId"
    | "contractType"
    | "signYear"
    | "startDate"
    | "endDate"
  >,
): Prisma.ContractWhereInput {
  const {
    keyword,
    customerKeyword,
    status,
    customerId,
    contractType,
    signYear,
    startDate,
    endDate,
  } = query;

  const where: Prisma.ContractWhereInput = { isDeleted: false };

  if (keyword) {
    where.OR = [
      { contractNo: { contains: keyword, mode: "insensitive" } },
      { name: { contains: keyword, mode: "insensitive" } },
      {
        customer: {
          name: {
            contains: keyword,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  if (customerKeyword) {
    where.customer = {
      name: {
        contains: customerKeyword,
        mode: "insensitive",
      },
    };
  }

  if (status) {
    where.status = status;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (contractType) {
    where.contractType = contractType;
  }

  const signDateFilter: Prisma.DateTimeFilter = {};

  if (signYear) {
    signDateFilter.gte = new Date(signYear, 0, 1, 0, 0, 0, 0);
    signDateFilter.lte = new Date(signYear, 11, 31, 23, 59, 59, 999);
  }

  if (startDate) {
    const rangeStart = parseDateRangeStart(startDate);
    signDateFilter.gte =
      signDateFilter.gte && signDateFilter.gte > rangeStart
        ? signDateFilter.gte
        : rangeStart;
  }

  if (endDate) {
    const rangeEnd = parseDateRangeEnd(endDate);
    signDateFilter.lte =
      signDateFilter.lte && signDateFilter.lte < rangeEnd
        ? signDateFilter.lte
        : rangeEnd;
  }

  if (signDateFilter.gte || signDateFilter.lte) {
    where.signDate = signDateFilter;
  }

  return where;
}

export function buildContractListQueryContext(args: {
  query: QueryContractDto;
  allowedSortFields: readonly string[];
  defaultSortBy?: string;
  maxPageSize?: number;
}) {
  const {
    page = 1,
    pageSize = 20,
    sortBy,
    sortOrder = "desc",
    keyword,
    customerKeyword,
    signYear,
    contractType,
    status,
    customerId,
    startDate,
    endDate,
  } = args.query;

  const safeSortBy = resolveSortField(
    sortBy || args.defaultSortBy || "createdAt",
    args.allowedSortFields,
    args.defaultSortBy || "createdAt",
  );
  const pagination = normalizePagination({
    page,
    pageSize,
    maxPageSize: args.maxPageSize,
  });

  return {
    page: pagination.page,
    pageSize: pagination.pageSize,
    skip: pagination.skip,
    sortOrder,
    safeSortBy,
    where: buildContractListWhere({
      keyword,
      customerKeyword,
      signYear,
      contractType,
      status,
      customerId,
      startDate,
      endDate,
    }),
  };
}

export function buildContractExportQuery(
  query: QueryContractDto,
): QueryContractDto {
  return {
    ...query,
    page: 1,
    pageSize: 10000,
    sortBy: query.sortBy || "signDate",
    sortOrder: query.sortOrder || "desc",
  };
}

export const CONTRACT_EXPORT_HEADERS = [
  "合同编号",
  "签约年份",
  "合同名称",
  "客户名称",
  "公司签约主体",
  "合同类型",
  "合同金额",
  "签署日期",
  "结束日期",
  "状态",
] as const;

export const CONTRACT_IMPORT_TEMPLATE_HEADERS = [
  "合同编号",
  "合同名称",
  "客户名称",
  "公司签约主体",
  "合同类型",
  "合同金额",
  "签署日期",
  "结束日期",
] as const;

export const CONTRACT_IMPORT_TEMPLATE_ROWS: unknown[][] = [
  [
    "HT-CUSTOM-0001",
    "示例合同A",
    "北京科技有限公司",
    "InfFinanceMs",
    "服务合同",
    100000,
    "2026-03-18",
    "2026-12-31",
  ],
];

export function buildContractPaymentMap(
  paymentSums: ContractPaymentGroupByRow[],
): Map<string, Decimal> {
  return new Map(
    paymentSums.map((row) => [
      row.contractId,
      row._sum.amount || new Decimal(0),
    ]),
  );
}

export function buildContractListResponse<T>(args: {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}) {
  return {
    items: args.items,
    total: args.total,
    page: args.page,
    pageSize: args.pageSize,
    totalPages: Math.ceil(args.total / args.pageSize),
  };
}

export function attachContractPaymentSummary<T extends ContractListItem>(
  items: T[],
  paymentMap: Map<string, Decimal>,
): Array<T & { totalPaid: Decimal; receivable: Decimal }> {
  return items.map((contract) => {
    const totalPaid = paymentMap.get(contract.id) || new Decimal(0);
    return {
      ...contract,
      totalPaid,
      receivable: new Decimal(contract.amountWithTax.toString()).minus(
        totalPaid,
      ),
    };
  });
}

export function buildContractExportRows<T extends ContractListItem>(
  items: T[],
  statusLabels: Record<string, string>,
): unknown[][] {
  return items.map((item) => {
    const signDate =
      item.signDate instanceof Date ? item.signDate : new Date(item.signDate);
    const endDate =
      item.endDate instanceof Date
        ? item.endDate
        : item.endDate
          ? new Date(item.endDate)
          : null;

    const amountText =
      item.amountWithTax === null || item.amountWithTax === undefined
        ? "0"
        : String(item.amountWithTax);

    return [
      item.contractNo,
      Number.isNaN(signDate.getTime()) ? "" : signDate.getFullYear(),
      item.name,
      item.customer?.name || "",
      item.signingEntity || "",
      item.contractType || "",
      amountText,
      formatDateOnly(signDate),
      formatDateOnly(endDate),
      statusLabels[item.status] || item.status,
    ];
  });
}
