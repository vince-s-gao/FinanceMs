// InfFinanceMs - 创建报销DTO

import {
  IsString,
  IsIn,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsBoolean,
  IsDateString,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// 报销类型
const EXPENSE_TYPES = ["TRAVEL", "DAILY", "PROJECT"] as const;
type ExpenseType = (typeof EXPENSE_TYPES)[number];

// 费用类型
const FEE_TYPES = [
  "TRAVEL",
  "TRANSPORT",
  "ACCOMMODATION",
  "MEAL",
  "OFFICE",
  "COMMUNICATION",
  "OTHER",
] as const;
type FeeType = (typeof FEE_TYPES)[number];

export class ExpenseDetailDto {
  @ApiProperty({ description: "费用类型", enum: FEE_TYPES })
  @IsIn(FEE_TYPES)
  feeType: FeeType;

  @ApiProperty({ description: "发生日期" })
  @IsDateString()
  occurDate: string;

  @ApiProperty({ description: "金额" })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: "是否有发票" })
  @IsBoolean()
  hasInvoice: boolean;

  @ApiPropertyOptional({ description: "发票类型" })
  @IsOptional()
  @IsString()
  invoiceType?: string;

  @ApiPropertyOptional({ description: "发票号码" })
  @IsOptional()
  @IsString()
  invoiceNo?: string;

  @ApiPropertyOptional({ description: "说明" })
  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateExpenseDto {
  @ApiProperty({ description: "关联项目ID（必填）" })
  @IsString()
  projectId: string;

  @ApiPropertyOptional({ description: "关联合同ID" })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: "报销事由" })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ description: "报销明细", type: [ExpenseDetailDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExpenseDetailDto)
  details: ExpenseDetailDto[];
}
