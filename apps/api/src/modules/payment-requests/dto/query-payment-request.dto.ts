// InfFinanceMs - 查询付款申请 DTO
import { IsString, IsOptional, IsEnum, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentRequestMethod } from './create-payment-request.dto';
import { Type } from 'class-transformer';

// 付款申请状态枚举
export enum PaymentRequestStatus {
  DRAFT = 'DRAFT',         // 草稿
  PENDING = 'PENDING',     // 待审批
  APPROVED = 'APPROVED',   // 已通过
  REJECTED = 'REJECTED',   // 已拒绝
  PAID = 'PAID',           // 已付款
  CANCELLED = 'CANCELLED', // 已取消
}

export class QueryPaymentRequestDto {
  @ApiPropertyOptional({ description: '申请单号' })
  @IsString()
  @IsOptional()
  requestNo?: string;

  @ApiPropertyOptional({ description: '付款事由关键词' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: '付款方式', enum: PaymentRequestMethod })
  @IsEnum(PaymentRequestMethod)
  @IsOptional()
  paymentMethod?: PaymentRequestMethod;

  @ApiPropertyOptional({ description: '申请状态', enum: PaymentRequestStatus })
  @IsEnum(PaymentRequestStatus)
  @IsOptional()
  status?: PaymentRequestStatus;

  @ApiPropertyOptional({ description: '关联项目ID' })
  @IsString()
  @IsOptional()
  projectId?: string;

  @ApiPropertyOptional({ description: '银行账户ID' })
  @IsString()
  @IsOptional()
  bankAccountId?: string;

  @ApiPropertyOptional({ description: '申请人ID' })
  @IsString()
  @IsOptional()
  applicantId?: string;

  @ApiPropertyOptional({ description: '付款日期开始' })
  @IsDateString()
  @IsOptional()
  paymentDateStart?: string;

  @ApiPropertyOptional({ description: '付款日期结束' })
  @IsDateString()
  @IsOptional()
  paymentDateEnd?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}
