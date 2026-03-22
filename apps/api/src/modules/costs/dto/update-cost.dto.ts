// InfFinanceMs - 更新费用DTO

import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { FEE_TYPES } from "@inffinancems/shared";

type FeeType = (typeof FEE_TYPES)[number];

export class UpdateCostDto {
  @ApiPropertyOptional({ description: "关联项目ID" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "费用类型", enum: FEE_TYPES })
  @IsOptional()
  @IsIn(FEE_TYPES)
  feeType?: FeeType;

  @ApiPropertyOptional({ description: "金额" })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({ description: "发生日期" })
  @IsOptional()
  @IsDateString()
  occurDate?: string;

  @ApiPropertyOptional({ description: "关联合同ID（可传 null 清空）" })
  @IsOptional()
  @IsString()
  contractId?: string | null;

  @ApiPropertyOptional({ description: "说明（可传 null 清空）" })
  @IsOptional()
  @IsString()
  description?: string | null;
}
