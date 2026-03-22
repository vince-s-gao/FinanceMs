import type { ContractOptionItem, InvoiceDirection } from './types';

export function resolveDirectionByContractType(contractType?: string | null): InvoiceDirection {
  const normalized = (contractType || '').trim().toUpperCase();
  return normalized.includes('SALES') || (contractType || '').includes('销售')
    ? 'OUTBOUND'
    : 'INBOUND';
}

export function isContractMatchedDirection(
  contract: ContractOptionItem | undefined,
  fixedDirection?: InvoiceDirection,
): boolean {
  if (!contract) return false;
  if (!fixedDirection) return true;
  return resolveDirectionByContractType(contract.contractType) === fixedDirection;
}

export function resolveAttachmentUrl(url?: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    try {
      const parsed = new URL(configured);
      return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
    } catch {
      // ignore invalid configured url
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001${normalizedPath}`;
  }

  return `http://127.0.0.1:3001${normalizedPath}`;
}

export function getTaxRateDisplay(amount?: number, taxAmount?: number): string {
  if (amount === null || amount === undefined || amount <= 0) return '-';
  if (taxAmount === null || taxAmount === undefined || taxAmount < 0) return '-';
  const baseWithoutTax = amount - taxAmount;
  if (baseWithoutTax <= 0) return '-';
  const rate = (taxAmount / baseWithoutTax) * 100;
  if (!Number.isFinite(rate)) return '-';
  return `${rate.toFixed(2)}%`;
}

export function parseCurrencyInput(value?: string | number): string {
  if (typeof value === 'number') return String(value);
  return (value || '').replace(/[¥,]/g, '');
}
