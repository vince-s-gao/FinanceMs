// InfFinanceMs - 创建费用DTO

import {
  IsString,
  IsIn,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FEE_TYPES } from "@inffinancems/shared";

type FeeType = (typeof FEE_TYPES)[number];

export class CreateCostDto {
  @ApiProperty({ description: "关联项目ID" })
  @IsString()
  projectId: string;

  @ApiProperty({ description: "费用类型", enum: FEE_TYPES })
  @IsIn(FEE_TYPES)
  feeType: FeeType;

  @ApiProperty({ description: "金额" })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: "发生日期" })
  @IsDateString()
  occurDate: string;

  @ApiPropertyOptional({ description: "关联合同ID" })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: "说明" })
  @IsOptional()
  @IsString()
  description?: string;
}
