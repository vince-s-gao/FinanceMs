// InfFinanceMs - 创建预算DTO

import { IsString, IsNumber, IsOptional, IsIn, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 费用类型
const FEE_TYPES = ['TRAVEL', 'TRANSPORT', 'ACCOMMODATION', 'MEAL', 'OFFICE', 'COMMUNICATION', 'OTHER'] as const;
type FeeType = typeof FEE_TYPES[number];

export class CreateBudgetDto {
  @ApiProperty({ description: '预算年度' })
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year: number;

  @ApiPropertyOptional({ description: '预算月份（1-12，为空表示年度预算）' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiProperty({ description: '部门' })
  @IsString()
  department: string;

  @ApiProperty({ description: '费用类型', enum: FEE_TYPES })
  @IsIn(FEE_TYPES)
  feeType: FeeType;

  @ApiProperty({ description: '预算金额' })
  @IsNumber()
  @Min(0)
  budgetAmount: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
