// InfFinanceMs - 查询预算DTO

import { IsOptional, IsString, IsNumber, IsIn, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 费用类型
const FEE_TYPES = ['TRAVEL', 'TRANSPORT', 'ACCOMMODATION', 'MEAL', 'OFFICE', 'COMMUNICATION', 'OTHER'] as const;
type FeeType = typeof FEE_TYPES[number];

// 预算状态
const BUDGET_STATUS = ['ACTIVE', 'FROZEN', 'CLOSED'] as const;
type BudgetStatus = typeof BUDGET_STATUS[number];

export class QueryBudgetDto extends PaginationDto {
  @ApiPropertyOptional({ description: '预算年度' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ description: '预算月份' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({ description: '部门' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: '费用类型', enum: FEE_TYPES })
  @IsOptional()
  @IsIn(FEE_TYPES)
  feeType?: FeeType;

  @ApiPropertyOptional({ description: '预算状态', enum: BUDGET_STATUS })
  @IsOptional()
  @IsIn(BUDGET_STATUS)
  status?: BudgetStatus;
}
