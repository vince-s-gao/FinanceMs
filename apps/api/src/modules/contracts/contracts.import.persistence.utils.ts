import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateContractDto } from "./dto/create-contract.dto";
import { createUpsertImportedContractHandlerByDeps } from "./contracts.import.flow.utils";

const IMPORT_EXISTING_CONTRACT_SELECT = {
  id: true,
  name: true,
  customerId: true,
  signingEntity: true,
  contractType: true,
  amountWithTax: true,
  amountWithoutTax: true,
  taxRate: true,
  signDate: true,
  endDate: true,
  isDeleted: true,
} satisfies Prisma.ContractSelect;

export function createImportContractUpsertHandlerByPrismaDeps(args: {
  prisma: PrismaService;
  createContract: (dto: CreateContractDto) => Promise<unknown>;
}) {
  return createUpsertImportedContractHandlerByDeps({
    findExistingByContractNo: (contractNo: string) =>
      args.prisma.contract.findUnique({
        where: { contractNo },
        select: IMPORT_EXISTING_CONTRACT_SELECT,
      }),
    updateExisting: (id: string, data: Prisma.ContractUpdateInput) =>
      args.prisma.contract.update({
        where: { id },
        data,
      }),
    createNew: async (createArgs) => {
      await args.createContract({
        ...createArgs.row.contractData,
        contractType: createArgs.contractTypeCode,
        customerId: createArgs.customerId,
      } as CreateContractDto);
    },
  });
}
