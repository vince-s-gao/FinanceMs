import type { UploadFile } from 'antd/es/upload/interface';

export interface DictionaryItem {
  id: string;
  code: string;
  name: string;
  color?: string;
}

export interface Contract {
  id: string;
  contractNo: string;
  name: string;
  customer: {
    id: string;
    name: string;
    code: string;
  };
  signingEntity?: string | null;
  contractType?: string | null;
  amountWithTax: number;
  status: string;
  signDate: string;
  endDate?: string | null;
}

export interface SearchFilters {
  keyword?: string;
  customerKeyword?: string;
  signYear?: number;
  contractType?: string;
  startDate?: string;
  endDate?: string;
}

export interface ImportPreviewResult {
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
}

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  total: number;
  success: number;
  failed: number;
  allowPartial: boolean;
  createdAt: string;
  errors: Array<{ row: number; message: string }>;
  operator?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface BatchAttachmentBindResult {
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
}

export interface ContractAttachmentUploadState {
  fileList: UploadFile[];
  files: File[];
}
