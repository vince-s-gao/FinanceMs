// InfFinanceMs - 创建回款记录DTO

import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsIn,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// 回款方式
const PAYMENT_METHODS = ["TRANSFER", "CASH", "CHECK"] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export class CreatePaymentRecordDto {
  @ApiProperty({ description: "合同ID" })
  @IsString()
  contractId: string;

  @ApiPropertyOptional({ description: "回款计划ID" })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiProperty({ description: "回款金额" })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: "回款日期" })
  @IsDateString()
  paymentDate: string;

  @ApiPropertyOptional({ description: "回款方式", enum: PAYMENT_METHODS })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: "备注" })
  @IsOptional()
  @IsString()
  remark?: string;
}
