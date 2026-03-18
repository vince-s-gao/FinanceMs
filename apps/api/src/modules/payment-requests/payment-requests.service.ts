// InfFinanceMs - 付款申请服务
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentRequestDto } from './dto/create-payment-request.dto';
import { UpdatePaymentRequestDto } from './dto/update-payment-request.dto';
import { QueryPaymentRequestDto } from './dto/query-payment-request.dto';
import { ApprovePaymentRequestDto } from './dto/approve-payment-request.dto';
import { Prisma } from '@prisma/client';
import { parseDateRangeEnd, parseDateRangeStart } from '../../common/utils/query.utils';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentRequestsService {
  constructor(
    private prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async notifyApproversForSubmit(request: any) {
    const approvers = await this.prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['MANAGER', 'ADMIN'] },
      },
      select: { id: true },
    });
    const approverIds = approvers.map((item) => item.id).filter((id) => id !== request.applicantId);
    await this.notificationsService.createForUsers(approverIds, {
      type: 'APPROVAL',
      title: '新的付款申请待审批',
      content: `付款申请 ${request.requestNo} 已提交，等待审批`,
      link: `/payment-requests/${request.id}`,
      metadata: {
        requestId: request.id,
        requestNo: request.requestNo,
      },
    });
  }

  private async notifyApplicant(
    request: any,
    title: string,
    content: string,
    type: 'SYSTEM' | 'APPROVAL' | 'PAYMENT' | 'ALERT',
  ) {
    if (!request.applicantId) return;
    await this.notificationsService.createNotification({
      userId: request.applicantId,
      title,
      content,
      type,
      link: `/payment-requests/${request.id}`,
      metadata: {
        requestId: request.id,
        requestNo: request.requestNo,
      },
    });
  }

  /**
   * 生成付款申请单号
   * 格式: FK + 年月日 + 4位序号，如 FK202401220001
   */
  private async generateRequestNo(today: Date): Promise<string> {
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const prefix = `FK${dateStr}`;

    // 查询当天最大序号
    const lastRequest = await this.prisma.paymentRequest.findFirst({
      where: {
        requestNo: { startsWith: prefix },
      },
      orderBy: { requestNo: 'desc' },
    });

    let sequence = 1;
    if (lastRequest) {
      const lastSequence = parseInt(lastRequest.requestNo.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`;
  }

  private isRequestNoConflict(error: unknown): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (error.code !== 'P2002') return false;
    const target = (error.meta?.target || []) as string[];
    return target.includes('requestNo');
  }

  /**
   * 创建付款申请
   */
  async create(createDto: CreatePaymentRequestDto, applicantId: string) {
    // 验证项目是否存在
    const project = await this.prisma.project.findFirst({
      where: { id: createDto.projectId, isDeleted: false },
    });
    if (!project) {
      throw new BadRequestException('关联项目不存在');
    }

    // 验证银行账户是否存在
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: createDto.bankAccountId },
    });
    if (!bankAccount) {
      throw new BadRequestException('银行账户不存在');
    }

    for (let i = 0; i < 8; i++) {
      const requestNo = await this.generateRequestNo(new Date());
      try {
        return await this.prisma.paymentRequest.create({
          data: {
            requestNo,
            reason: createDto.reason,
            amount: createDto.amount,
            currency: createDto.currency || 'CNY',
            paymentMethod: createDto.paymentMethod,
            paymentDate: new Date(createDto.paymentDate),
            project: { connect: { id: createDto.projectId } },
            bankAccount: { connect: { id: createDto.bankAccountId } },
            payeeName: createDto.payeeName,
            payeeAccount: createDto.payeeAccount,
            payeeBank: createDto.payeeBank,
            attachments: createDto.attachments ? JSON.parse(JSON.stringify(createDto.attachments)) : undefined,
            applicant: { connect: { id: applicantId } },
            remark: createDto.remark,
            status: 'DRAFT',
          },
          include: {
            project: {
              select: { id: true, code: true, name: true },
            },
            bankAccount: true,
            applicant: {
              select: { id: true, name: true, email: true },
            },
          },
        });
      } catch (error) {
        if (this.isRequestNoConflict(error) && i < 7) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('付款申请编号生成失败，请重试');
  }

  /**
   * 查询付款申请列表
   */
  async findAll(query: QueryPaymentRequestDto) {
    const {
      requestNo,
      reason,
      paymentMethod,
      status,
      projectId,
      bankAccountId,
      applicantId,
      paymentDateStart,
      paymentDateEnd,
      page = 1,
      pageSize = 10,
    } = query;

    const where: any = {
      isDeleted: false,
    };

    if (requestNo) {
      where.requestNo = { contains: requestNo };
    }
    if (reason) {
      where.reason = { contains: reason };
    }
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    if (status) {
      where.status = status;
    }
    if (projectId) {
      where.projectId = projectId;
    }
    if (bankAccountId) {
      where.bankAccountId = bankAccountId;
    }
    if (applicantId) {
      where.applicantId = applicantId;
    }
    if (paymentDateStart || paymentDateEnd) {
      where.paymentDate = {};
      if (paymentDateStart) {
        where.paymentDate.gte = parseDateRangeStart(paymentDateStart);
      }
      if (paymentDateEnd) {
        where.paymentDate.lte = parseDateRangeEnd(paymentDateEnd);
      }
    }

    const [total, items] = await Promise.all([
      this.prisma.paymentRequest.count({ where }),
      this.prisma.paymentRequest.findMany({
        where,
        include: {
          project: {
            select: { id: true, code: true, name: true },
          },
          bankAccount: true,
          applicant: {
            select: { id: true, name: true, email: true },
          },
          approver: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
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
   * 获取付款申请详情
   */
  async findOne(id: string) {
    const request = await this.prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, code: true, name: true },
        },
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true, phone: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!request || request.isDeleted) {
      throw new NotFoundException('付款申请不存在');
    }

    return request;
  }

  /**
   * 更新付款申请（仅草稿状态可更新）
   */
  async update(id: string, updateDto: UpdatePaymentRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的申请可以修改');
    }

    // 如果更新银行账户，验证是否存在
    if (updateDto.bankAccountId) {
      const bankAccount = await this.prisma.bankAccount.findUnique({
        where: { id: updateDto.bankAccountId },
      });
      if (!bankAccount) {
        throw new BadRequestException('银行账户不存在');
      }
    }
    // 如果更新项目，验证是否存在
    if (updateDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: updateDto.projectId, isDeleted: false },
      });
      if (!project) {
        throw new BadRequestException('关联项目不存在');
      }
    }

    // 构建更新数据
    const updateData: any = {
      reason: updateDto.reason,
      amount: updateDto.amount,
      currency: updateDto.currency,
      paymentMethod: updateDto.paymentMethod,
      payeeName: updateDto.payeeName,
      payeeAccount: updateDto.payeeAccount,
      payeeBank: updateDto.payeeBank,
      remark: updateDto.remark,
    };

    if (updateDto.paymentDate) {
      updateData.paymentDate = new Date(updateDto.paymentDate);
    }

    if (updateDto.bankAccountId) {
      updateData.bankAccount = { connect: { id: updateDto.bankAccountId } };
    }
    if (updateDto.projectId) {
      updateData.project = { connect: { id: updateDto.projectId } };
    }

    if (updateDto.attachments) {
      updateData.attachments = JSON.parse(JSON.stringify(updateDto.attachments));
    }

    // 移除 undefined 值
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    return this.prisma.paymentRequest.update({
      where: { id },
      data: updateData,
      include: {
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * 提交付款申请（草稿 -> 待审批）
   */
  async submit(id: string) {
    const request = await this.findOne(id);

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的申请可以提交');
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'PENDING',
        submitDate: new Date(),
      },
      include: {
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.notifyApproversForSubmit(request);
    return updated;
  }

  /**
   * 审批付款申请
   */
  async approve(id: string, approveDto: ApprovePaymentRequestDto, approverId: string) {
    const request = await this.findOne(id);

    if (request.status !== 'PENDING') {
      throw new BadRequestException('只有待审批状态的申请可以审批');
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: approveDto.status,
        approvedBy: approverId,
        approvedAt: new Date(),
        approvalRemark: approveDto.approvalRemark,
      },
      include: {
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    const isApproved = approveDto.status === 'APPROVED';
    await this.notifyApplicant(
      request,
      isApproved ? '付款申请已审批通过' : '付款申请已被驳回',
      isApproved
        ? `付款申请 ${request.requestNo} 已审批通过`
        : `付款申请 ${request.requestNo} 已被驳回`,
      'APPROVAL',
    );

    return updated;
  }

  /**
   * 确认付款（已通过 -> 已付款）
   */
  async confirmPayment(id: string, remark?: string) {
    const request = await this.findOne(id);

    if (request.status !== 'APPROVED') {
      throw new BadRequestException('只有已通过的申请可以确认付款');
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'PAID',
        remark: remark || request.remark,
      },
      include: {
        bankAccount: true,
        applicant: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await this.notifyApplicant(
      request,
      '付款申请已完成付款',
      `付款申请 ${request.requestNo} 已完成付款处理`,
      'PAYMENT',
    );

    return updated;
  }

  /**
   * 取消付款申请
   */
  async cancel(id: string) {
    const request = await this.findOne(id);

    if (!['DRAFT', 'PENDING'].includes(request.status)) {
      throw new BadRequestException('只有草稿或待审批状态的申请可以取消');
    }

    return this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  /**
   * 删除付款申请（软删除，仅草稿状态可删除）
   */
  async remove(id: string) {
    const request = await this.findOne(id);

    if (request.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的申请可以删除');
    }

    return this.prisma.paymentRequest.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  /**
   * 获取付款申请统计
   */
  async getStatistics() {
    const [
      totalCount,
      draftCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      paidCount,
      totalAmount,
      paidAmount,
    ] = await Promise.all([
      this.prisma.paymentRequest.count({ where: { isDeleted: false } }),
      this.prisma.paymentRequest.count({ where: { isDeleted: false, status: 'DRAFT' } }),
      this.prisma.paymentRequest.count({ where: { isDeleted: false, status: 'PENDING' } }),
      this.prisma.paymentRequest.count({ where: { isDeleted: false, status: 'APPROVED' } }),
      this.prisma.paymentRequest.count({ where: { isDeleted: false, status: 'REJECTED' } }),
      this.prisma.paymentRequest.count({ where: { isDeleted: false, status: 'PAID' } }),
      this.prisma.paymentRequest.aggregate({
        where: { isDeleted: false },
        _sum: { amount: true },
      }),
      this.prisma.paymentRequest.aggregate({
        where: { isDeleted: false, status: 'PAID' },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalCount,
      draftCount,
      pendingCount,
      approvedCount,
      rejectedCount,
      paidCount,
      totalAmount: totalAmount._sum.amount || 0,
      paidAmount: paidAmount._sum.amount || 0,
    };
  }
}
