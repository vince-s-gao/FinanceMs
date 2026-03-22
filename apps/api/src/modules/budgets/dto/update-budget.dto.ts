// InfFinanceMs - 更新预算DTO

import { IsNumber, IsOptional, IsString, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateBudgetDto {
  @ApiPropertyOptional({ description: "预算金额" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional({ description: "备注" })
  @IsOptional()
  @IsString()
  remark?: string;
}
