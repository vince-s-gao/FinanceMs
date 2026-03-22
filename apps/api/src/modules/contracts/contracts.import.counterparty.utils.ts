import { ConflictException } from "@nestjs/common";
import { createWithGeneratedCode } from "../../common/utils/code-generator.utils";

type IdRecord = { id: string };

export async function ensureImportCustomerByDeps(args: {
  customerName: string;
  customerIdByName: Map<string, string>;
  visibleInCustomerList: boolean;
  findVisibleCustomer: (customerName: string) => Promise<IdRecord | null>;
  findHiddenCustomer: (customerName: string) => Promise<IdRecord | null>;
  restoreHiddenCustomer: (customerId: string) => Promise<void>;
  generateCode: () => Promise<string>;
  createWithCode: (code: string) => Promise<IdRecord>;
  isCodeConflict: (error: unknown) => boolean;
  exhaustedErrorMessage: string;
  maxRetries?: number;
}): Promise<string> {
  const cached = args.customerIdByName.get(args.customerName);
  if (cached) {
    return cached;
  }

  const existing = await args.findVisibleCustomer(args.customerName);
  if (existing) {
    args.customerIdByName.set(args.customerName, existing.id);
    return existing.id;
  }

  const existingHidden = await args.findHiddenCustomer(args.customerName);
  if (existingHidden) {
    if (args.visibleInCustomerList) {
      await args.restoreHiddenCustomer(existingHidden.id);
    }
    args.customerIdByName.set(args.customerName, existingHidden.id);
    return existingHidden.id;
  }

  const created = await createWithGeneratedCode({
    generateCode: args.generateCode,
    create: args.createWithCode,
    isCodeConflict: args.isCodeConflict,
    exhaustedError: () => new ConflictException(args.exhaustedErrorMessage),
    maxRetries: args.maxRetries ?? 8,
  });

  args.customerIdByName.set(args.customerName, created.id);
  return created.id;
}

export async function ensureImportSupplierByDeps(args: {
  supplierName: string;
  supplierIdByName: Map<string, string>;
  findVisibleSupplier: (supplierName: string) => Promise<IdRecord | null>;
  generateCode: () => Promise<string>;
  createWithCode: (code: string) => Promise<IdRecord>;
  isCodeConflict: (error: unknown) => boolean;
  exhaustedErrorMessage: string;
  maxRetries?: number;
}): Promise<string> {
  const cached = args.supplierIdByName.get(args.supplierName);
  if (cached) {
    return cached;
  }

  const existing = await args.findVisibleSupplier(args.supplierName);
  if (existing) {
    args.supplierIdByName.set(args.supplierName, existing.id);
    return existing.id;
  }

  const created = await createWithGeneratedCode({
    generateCode: args.generateCode,
    create: args.createWithCode,
    isCodeConflict: args.isCodeConflict,
    exhaustedError: () => new ConflictException(args.exhaustedErrorMessage),
    maxRetries: args.maxRetries ?? 8,
  });

  args.supplierIdByName.set(args.supplierName, created.id);
  return created.id;
}
