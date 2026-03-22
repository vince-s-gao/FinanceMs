import type { CreateContractDto } from "./dto/create-contract.dto";

export type ImportContractResult = {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
};

export type ImportLogPayload = {
  fileName: string;
  total: number;
  success: number;
  failed: number;
  allowPartial: boolean;
  errors: Array<{ row: number; message: string }>;
  operatorId?: string;
};

export type ImportCsvOptions = {
  allowPartial?: boolean;
  fileName?: string;
  operatorId?: string;
};

export type ImportExecutionContext = {
  allowPartial: boolean;
  fileName: string;
  operatorId?: string;
  defaultCustomerType: string;
  defaultSupplierType: string;
  customerIdByName: Map<string, string>;
  supplierIdByName: Map<string, string>;
  contractTypeCodeByLookup: Map<string, string>;
  contractTypeSortOrderState: { next: number };
};

export type ImportPreviewResult = {
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

export type ImportHistoryItem = {
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

export type PreparedImportRow = {
  row: number;
  customerName: string;
  contractTypeText: string;
  contractData: Omit<CreateContractDto, "customerId">;
};

export type PreparedImportResult = {
  total: number;
  validRows: PreparedImportRow[];
  errors: Array<{ row: number; message: string }>;
  contractTypeCodeByLookup: Map<string, string>;
};

export type BatchBindContractAttachmentsResult = {
  total: number;
  success: number;
  failed: number;
  items: Array<{
    fileName: string;
    contractId: string;
    contractNo: string;
    attachmentName: string;
  }>;
  errors: Array<{
    fileName: string;
    message: string;
  }>;
};

export type ContractAttachmentTarget = {
  id: string;
  contractNo: string;
  normalizedContractNo: string;
  attachmentUrl?: string | null;
};
