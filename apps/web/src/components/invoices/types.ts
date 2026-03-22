import type dayjs from "dayjs";

export type InvoiceDirection = "INBOUND" | "OUTBOUND";

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number;
  invoiceDate: string;
  status: string;
  direction: InvoiceDirection;
  attachmentUrl?: string;
  attachmentName?: string;
  contract: {
    id: string;
    contractNo: string;
    name: string;
    customer: {
      id: string;
      name: string;
    };
  };
}

export interface ContractOptionItem {
  id: string;
  contractNo: string;
  name: string;
  contractType?: string | null;
  customer?: {
    name?: string;
  };
}

export interface ContractSelectOption {
  value: string;
  label: string;
}

export interface InvoiceImportError {
  row: number;
  fileName: string;
  message: string;
}

export interface InvoiceImportSample {
  row: number;
  fileName: string;
  contractNo: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number | null;
  invoiceDate: string;
}

export interface InvoiceImportPreview {
  total: number;
  valid: number;
  invalid: number;
  errors: InvoiceImportError[];
  samples: InvoiceImportSample[];
}

export interface InvoiceImportSummary {
  total: number;
  success: number;
  failed: number;
  errors: InvoiceImportError[];
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
}

export interface ContractListResponse {
  items: ContractOptionItem[];
}

export interface InvoiceManagementPageProps {
  fixedDirection?: InvoiceDirection;
  hidePageTitle?: boolean;
}

export interface InvoiceFormValues {
  contractId: string;
  invoiceNo: string;
  invoiceType: string;
  amount: number;
  taxAmount?: number;
  invoiceDate: dayjs.Dayjs;
}

export const INVOICE_PAGE_TITLE: Record<InvoiceDirection, string> = {
  INBOUND: "进项发票管理",
  OUTBOUND: "出项发票管理",
};

export const INVOICE_CONTRACT_HINT: Record<InvoiceDirection, string> = {
  INBOUND: "仅可选择采购类合同",
  OUTBOUND: "仅可选择销售类合同",
};
