// InfFinanceMs - 客户服务

import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { ApprovalStatus, Prisma } from '@prisma/client';
import { resolveSortField } from '../../common/utils/query.utils';

// 生成客户编号
function generateCustomerCode(sequence: number): string {
  return `CUS${String(sequence).padStart(6, '0')}`;
}

const ALLOWED_CUSTOMER_SORT_FIELDS = [
  'code',
  'name',
  'type',
  'approvalStatus',
  'createdAt',
  'updatedAt',
] as const;

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成客户编号
   */
  private async generateCode(): Promise<string> {
    const lastCustomer = await this.prisma.customer.findFirst({
      where: {
        code: {
          startsWith: 'CUS',
        },
      },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let sequence = 1;
    if (lastCustomer?.code) {
      const match = lastCustomer.code.match(/^CUS(\d{6})$/);
      if (match) {
        sequence = Number(match[1]) + 1;
      }
    }

    return generateCustomerCode(sequence);
  }

  private isUniqueConflict(error: unknown, field: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes(field);
  }

  /**
   * 获取客户列表
   */
  async findAll(query: QueryCustomerDto) {
    const { page = 1, pageSize = 20, keyword, type, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_CUSTOMER_SORT_FIELDS, 'createdAt');

    const where: any = {
      isDeleted: false,
    };

    // 关键词搜索（名称、编号、联系人）
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
        { contactName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 客户类型筛选
    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          _count: {
            select: { contracts: true },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取客户详情
   */
  async findOne(id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, isDeleted: false },
      include: {
        contracts: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('客户不存在');
    }

    return customer;
  }

  /**
   * 创建客户
   */
  async create(createCustomerDto: CreateCustomerDto, userId: string) {
    // 检查信用代码是否重复
    if (createCustomerDto.creditCode) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          creditCode: createCustomerDto.creditCode,
          isDeleted: false,
        },
      });
      if (existing) {
        throw new ConflictException('该统一社会信用代码已存在');
      }
    }

    for (let i = 0; i < 8; i++) {
      const code = await this.generateCode();
      try {
        return await this.prisma.customer.create({
          data: {
            ...createCustomerDto,
            code,
            approvalStatus: ApprovalStatus.PENDING,
            submittedBy: userId,
            submittedAt: new Date(),
          },
        });
      } catch (error) {
        if (this.isUniqueConflict(error, 'code')) {
          if (i < 7) {
            continue;
          }
          break;
        }
        if (this.isUniqueConflict(error, 'creditCode')) {
          throw new ConflictException('该统一社会信用代码已存在');
        }
        throw error;
      }
    }

    throw new ConflictException('客户编号生成失败，请重试');
  }

  /**
   * 更新客户
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto) {
    const customer = await this.findOne(id);

    // 检查信用代码是否重复
    if (updateCustomerDto.creditCode && updateCustomerDto.creditCode !== customer.creditCode) {
      const existing = await this.prisma.customer.findFirst({
        where: {
          creditCode: updateCustomerDto.creditCode,
          isDeleted: false,
          NOT: { id },
        },
      });
      if (existing) {
        throw new ConflictException('该统一社会信用代码已存在');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data: updateCustomerDto,
    });
  }

  /**
   * 删除客户（软删除）
   */
  async remove(id: string) {
    await this.findOne(id);

    // 检查是否有关联合同
    const contractCount = await this.prisma.contract.count({
      where: { customerId: id, isDeleted: false },
    });

    if (contractCount > 0) {
      throw new ConflictException('该客户存在关联合同，无法删除');
    }

    return this.prisma.customer.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  /**
   * 获取客户选项列表（用于下拉选择）
   * 只返回已审批通过的客户
   */
  async getOptions() {
    return this.prisma.customer.findMany({
      where: { 
        isDeleted: false,
        approvalStatus: ApprovalStatus.APPROVED, // 只返回已审批通过的客户
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * 审批客户
   */
  async approve(id: string, approveDto: ApproveCustomerDto, userId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, isDeleted: false },
    });

    if (!customer) {
      throw new NotFoundException('客户不存在');
    }

    // 检查审批状态：只有待审批或已拒绝的客户可以审批
    if (customer.approvalStatus === ApprovalStatus.APPROVED) {
      throw new ConflictException('该客户已审批通过，无法重复审批');
    }

    const { approved, remark } = approveDto;

    return this.prisma.customer.update({
      where: { id },
      data: {
        approvalStatus: approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        approvedBy: userId,
        approvedAt: new Date(),
        approvalRemark: remark,
      },
    });
  }

  /**
   * 获取待审批客户列表
   */
  async findPendingApproval(query: QueryCustomerDto) {
    const { page = 1, pageSize = 20, keyword, type, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * pageSize;
    const safeSortBy = resolveSortField(sortBy, ALLOWED_CUSTOMER_SORT_FIELDS, 'createdAt');

    const where: any = {
      isDeleted: false,
      approvalStatus: ApprovalStatus.PENDING, // 只查询待审批的客户
    };

    // 关键词搜索（名称、编号、联系人）
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
        { contactName: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 客户类型筛选
    if (type) {
      where.type = type;
    }

    const [items, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [safeSortBy]: sortOrder },
        include: {
          submitter: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
