// InfFinanceMs - 查询报销DTO

import { IsOptional, IsString, IsIn, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../../common/dto/pagination.dto";

// 报销状态
const EXPENSE_STATUS = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "PAID",
] as const;
type ExpenseStatus = (typeof EXPENSE_STATUS)[number];

export class QueryExpenseDto extends PaginationDto {
  @ApiPropertyOptional({ description: "关键词搜索（报销单号、申请人姓名）" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: "报销状态", enum: EXPENSE_STATUS })
  @IsOptional()
  @IsIn(EXPENSE_STATUS)
  status?: ExpenseStatus;

  @ApiPropertyOptional({ description: "创建日期开始" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "创建日期结束" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
