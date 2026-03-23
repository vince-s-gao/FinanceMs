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

@Injectable()
export class BankAccountsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建银行账户
   */
  async create(createDto: CreateBankAccountDto) {
    // 检查账号是否已存在
    const existing = await this.prisma.bankAccount.findUnique({
      where: { accountNo: createDto.accountNo },
    });
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

    return this.prisma.bankAccount.create({
      data: {
        accountType: createDto.accountType || "PERSONAL",
        accountName: createDto.accountName,
        accountNo: createDto.accountNo,
        bankCode: createDto.bankCode,
        bankName: createDto.bankName,
        region: createDto.region,
        bankBranch: createDto.bankBranch,
        currency: createDto.currency || "CNY",
        isDefault: createDto.isDefault || false,
        remark: createDto.remark,
      },
    });
  }

  /**
   * 查询所有银行账户
   */
  async findAll(onlyEnabled: boolean = true) {
    const where: Prisma.BankAccountWhereInput = {};
    if (onlyEnabled) {
      where.isEnabled = true;
    }

    return this.prisma.bankAccount.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
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

    return account;
  }

  /**
   * 更新银行账户
   */
  async update(id: string, updateDto: UpdateBankAccountDto) {
    await this.findOne(id);

    // 如果更新账号，检查是否与其他账户重复
    if (updateDto.accountNo) {
      const existing = await this.prisma.bankAccount.findFirst({
        where: {
          accountNo: updateDto.accountNo,
          id: { not: id },
        },
      });
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

    return this.prisma.bankAccount.update({
      where: { id },
      data: updateDto,
    });
  }

  /**
   * 启用/禁用银行账户
   */
  async toggleEnabled(id: string) {
    const account = await this.findOne(id);

    return this.prisma.bankAccount.update({
      where: { id },
      data: { isEnabled: !account.isEnabled },
    });
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
    return this.prisma.bankAccount.update({
      where: { id },
      data: { isDefault: true },
    });
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

    return this.prisma.bankAccount.delete({
      where: { id },
    });
  }
}
