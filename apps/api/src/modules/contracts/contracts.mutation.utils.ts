import { BadRequestException } from "@nestjs/common";
import type { CreateContractDto } from "./dto/create-contract.dto";
import type { UpdateContractDto } from "./dto/update-contract.dto";

export function ensureDraftOnlyForAction(args: {
  status: string;
  allowNonDraft: boolean;
  actionText: "编辑" | "删除";
  draftStatus: string;
}) {
  if (args.status !== args.draftStatus && !args.allowNonDraft) {
    throw new BadRequestException(`只有草稿状态的合同可以${args.actionText}`);
  }
}

export function ensureValidStatusTransition(args: {
  currentStatus: string;
  nextStatus: string;
  statusTransitions: Record<string, string[]>;
}) {
  if (!args.statusTransitions[args.currentStatus]?.includes(args.nextStatus)) {
    throw new BadRequestException(
      `不能从 ${args.currentStatus} 状态变更为 ${args.nextStatus} 状态`,
    );
  }
}

export function normalizeRequiredContractNo(args: {
  contractNo: string;
  normalize: (value?: string) => string;
}): string {
  const normalizedContractNo = args.normalize(args.contractNo);
  if (!normalizedContractNo) {
    throw new BadRequestException("合同编号不能为空");
  }
  return normalizedContractNo;
}

export function normalizeOptionalContractNo(args: {
  contractNo?: string;
  normalize: (value?: string) => string;
}): string | undefined {
  if (args.contractNo === undefined) return undefined;
  const normalizedContractNo = args.normalize(args.contractNo);
  if (!normalizedContractNo) {
    throw new BadRequestException("合同编号不能为空");
  }
  return normalizedContractNo;
}

export function buildCreateContractPersistData(
  createContractDto: CreateContractDto,
  normalizedContractNo: string,
) {
  return {
    ...createContractDto,
    contractNo: normalizedContractNo,
    signDate: new Date(createContractDto.signDate),
    startDate: createContractDto.startDate
      ? new Date(createContractDto.startDate)
      : null,
    endDate: createContractDto.endDate
      ? new Date(createContractDto.endDate)
      : null,
  };
}

export function buildUpdateContractPersistData(
  updateContractDto: UpdateContractDto,
  normalizedContractNo?: string,
) {
  return {
    ...updateContractDto,
    contractNo: normalizedContractNo,
    signDate: updateContractDto.signDate
      ? new Date(updateContractDto.signDate)
      : undefined,
    startDate: updateContractDto.startDate
      ? new Date(updateContractDto.startDate)
      : undefined,
    endDate: updateContractDto.endDate
      ? new Date(updateContractDto.endDate)
      : undefined,
  };
}

type CounterpartyCustomer = {
  id: string;
  name: string;
  isDeleted: boolean;
};

type CounterpartyCustomerVisibility = {
  id: string;
  isDeleted: boolean;
};

type SyncCounterpartyByContractTypeArgs = {
  contractTypeCode?: string;
  counterpartyName?: string;
  supplierIdByName: Map<string, string>;
  defaultSupplierType: string;
  isSalesContractType?: boolean;
};

export async function resolveCreateCounterpartyNameByDeps(args: {
  customerId: string;
  isSalesContractType: boolean;
  findCustomer: (
    customerId: string,
    isSalesContractType: boolean,
  ) => Promise<CounterpartyCustomer | null>;
  restoreCustomerVisibility: (customerId: string) => Promise<void>;
}): Promise<string> {
  const customer = await args.findCustomer(
    args.customerId,
    args.isSalesContractType,
  );
  if (!customer) {
    throw new BadRequestException("对方签约主体不存在");
  }

  if (args.isSalesContractType && customer.isDeleted) {
    await args.restoreCustomerVisibility(customer.id);
  }

  return customer.name;
}

export async function resolveCreateCounterpartyContextByDeps(args: {
  customerId: string;
  contractTypeCode?: string;
  resolveIsSalesContractType: (contractTypeCode: string) => Promise<boolean>;
  findCustomer: (
    customerId: string,
    isSalesContractType: boolean,
  ) => Promise<CounterpartyCustomer | null>;
  restoreCustomerVisibility: (customerId: string) => Promise<void>;
}): Promise<{ isSalesContractType: boolean; counterpartyName: string }> {
  const isSalesContractType = args.contractTypeCode
    ? await args.resolveIsSalesContractType(args.contractTypeCode)
    : true;

  const counterpartyName = await resolveCreateCounterpartyNameByDeps({
    customerId: args.customerId,
    isSalesContractType,
    findCustomer: args.findCustomer,
    restoreCustomerVisibility: args.restoreCustomerVisibility,
  });

  return { isSalesContractType, counterpartyName };
}

export async function resolveUpdateCounterpartyNameByDeps(args: {
  nextCustomerId?: string;
  currentCustomerId?: string;
  currentCounterpartyName?: string;
  isSalesContractType: boolean;
  findCustomer: (
    customerId: string,
    isSalesContractType: boolean,
  ) => Promise<CounterpartyCustomer | null>;
  findCurrentCustomerVisibility: (
    customerId: string,
  ) => Promise<CounterpartyCustomerVisibility | null>;
  restoreCustomerVisibility: (customerId: string) => Promise<void>;
}): Promise<string> {
  let resolvedCounterpartyName = args.currentCounterpartyName || "";

  if (args.nextCustomerId) {
    const customer = await args.findCustomer(
      args.nextCustomerId,
      args.isSalesContractType,
    );
    if (!customer) {
      throw new BadRequestException("对方签约主体不存在");
    }
    resolvedCounterpartyName = customer.name;

    if (args.isSalesContractType && customer.isDeleted) {
      await args.restoreCustomerVisibility(customer.id);
    }
    return resolvedCounterpartyName;
  }

  if (args.isSalesContractType && args.currentCustomerId) {
    const currentCustomer = await args.findCurrentCustomerVisibility(
      args.currentCustomerId,
    );
    if (currentCustomer?.isDeleted) {
      await args.restoreCustomerVisibility(currentCustomer.id);
    }
  }

  return resolvedCounterpartyName;
}

export async function resolveUpdateCounterpartyContextByDeps(args: {
  nextCustomerId?: string;
  currentCustomerId?: string;
  currentCounterpartyName?: string;
  contractTypeCode?: string;
  resolveIsSalesContractType: (contractTypeCode: string) => Promise<boolean>;
  findCustomer: (
    customerId: string,
    isSalesContractType: boolean,
  ) => Promise<CounterpartyCustomer | null>;
  findCurrentCustomerVisibility: (
    customerId: string,
  ) => Promise<CounterpartyCustomerVisibility | null>;
  restoreCustomerVisibility: (customerId: string) => Promise<void>;
}): Promise<{ isSalesContractType: boolean; counterpartyName: string }> {
  const isSalesContractType = args.contractTypeCode
    ? await args.resolveIsSalesContractType(args.contractTypeCode)
    : true;

  const counterpartyName = await resolveUpdateCounterpartyNameByDeps({
    nextCustomerId: args.nextCustomerId,
    currentCustomerId: args.currentCustomerId,
    currentCounterpartyName: args.currentCounterpartyName || "",
    isSalesContractType,
    findCustomer: args.findCustomer,
    findCurrentCustomerVisibility: args.findCurrentCustomerVisibility,
    restoreCustomerVisibility: args.restoreCustomerVisibility,
  });

  return { isSalesContractType, counterpartyName };
}

export async function syncCounterpartyForContractMutationByDeps(args: {
  contractTypeCode?: string;
  counterpartyName: string;
  isSalesContractType: boolean;
  defaultSupplierType: string;
  syncCounterpartyByContractType: (
    args: SyncCounterpartyByContractTypeArgs,
  ) => Promise<void>;
}) {
  if (!args.contractTypeCode) {
    return;
  }
  await args.syncCounterpartyByContractType({
    contractTypeCode: args.contractTypeCode,
    counterpartyName: args.counterpartyName,
    supplierIdByName: new Map<string, string>(),
    defaultSupplierType: args.defaultSupplierType,
    isSalesContractType: args.isSalesContractType,
  });
}
