// InfFinanceMs - 银行账户服务
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";
import type { Prisma } from "@prisma/client";
import {
  decryptIfNeeded,
  encryptNullable,
} from "../../common/utils/encryption.utils";

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  private toEncryptedAccountNo(
    value: string | null | undefined,
  ): string | null {
    return encryptNullable(value || null);
  }

  private decodeAccount<T extends { accountNo?: string | null }>(item: T): T {
    if (!item) return item;
    return {
      ...item,
      accountNo: decryptIfNeeded(item.accountNo),
    };
  }

  private async findByAccountNo(accountNo: string) {
    const encrypted = this.toEncryptedAccountNo(accountNo);
    return this.prisma.bankAccount.findFirst({
      where: {
        OR: [{ accountNo: encrypted }, { accountNo }],
      },
    });
  }

  private async findDuplicateAccountNo(accountNo: string, currentId: string) {
    const encrypted = this.toEncryptedAccountNo(accountNo);
    return this.prisma.bankAccount.findFirst({
      where: {
        id: { not: currentId },
        OR: [{ accountNo: encrypted }, { accountNo }],
      },
    });
  }

  /**
   * 创建银行账户
   */
  async create(createDto: CreateBankAccountDto) {
    const encryptedAccountNo = this.toEncryptedAccountNo(createDto.accountNo);
    // 检查账号是否已存在
    const existing = await this.findByAccountNo(createDto.accountNo);
    if (existing) {
      throw new BadRequestException("该银行账号已存在");
    }

    // 如果设置为默认账户，先取消其他默认账户
    if (createDto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.bankAccount.create({
      data: {
        accountType: createDto.accountType || "PERSONAL",
        accountName: createDto.accountName,
        accountNo: encryptedAccountNo,
        bankCode: createDto.bankCode,
        bankName: createDto.bankName,
        region: createDto.region,
        bankBranch: createDto.bankBranch,
        currency: createDto.currency || "CNY",
        isDefault: createDto.isDefault || false,
        remark: createDto.remark,
      },
    });
    return this.decodeAccount(created);
  }

  /**
   * 查询所有银行账户
   */
  async findAll(onlyEnabled: boolean = true) {
    const where: Prisma.BankAccountWhereInput = {};
    if (onlyEnabled) {
      where.isEnabled = true;
    }

    const items = await this.prisma.bankAccount.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
    return items.map((item) => this.decodeAccount(item));
  }

  /**
   * 获取银行账户详情
   */
  async findOne(id: string) {
    const account = await this.prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new NotFoundException("银行账户不存在");
    }

    return this.decodeAccount(account);
  }

  /**
   * 更新银行账户
   */
  async update(id: string, updateDto: UpdateBankAccountDto) {
    await this.findOne(id);

    // 如果更新账号，检查是否与其他账户重复
    if (updateDto.accountNo) {
      const existing = await this.findDuplicateAccountNo(
        updateDto.accountNo,
        id,
      );
      if (existing) {
        throw new BadRequestException("该银行账号已存在");
      }
    }

    // 如果设置为默认账户，先取消其他默认账户
    if (updateDto.isDefault) {
      await this.prisma.bankAccount.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...updateDto,
        ...(updateDto.accountNo !== undefined
          ? { accountNo: this.toEncryptedAccountNo(updateDto.accountNo) }
          : {}),
      },
    });
    return this.decodeAccount(updated);
  }

  /**
   * 启用/禁用银行账户
   */
  async toggleEnabled(id: string) {
    const account = await this.findOne(id);

    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: { isEnabled: !account.isEnabled },
    });
    return this.decodeAccount(updated);
  }

  /**
   * 设置默认账户
   */
  async setDefault(id: string) {
    await this.findOne(id);

    // 先取消所有默认账户
    await this.prisma.bankAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });

    // 设置当前账户为默认
    const updated = await this.prisma.bankAccount.update({
      where: { id },
      data: { isDefault: true },
    });
    return this.decodeAccount(updated);
  }

  /**
   * 删除银行账户
   */
  async remove(id: string) {
    const account = await this.findOne(id);

    // 检查是否有关联的付款申请
    const requestCount = await this.prisma.paymentRequest.count({
      where: { bankAccountId: id },
    });

    if (requestCount > 0) {
      throw new BadRequestException(
        `该银行账户已关联 ${requestCount} 条付款申请，无法删除`,
      );
    }

    const removed = await this.prisma.bankAccount.delete({
      where: { id },
    });
    return this.decodeAccount(removed);
  }
}
