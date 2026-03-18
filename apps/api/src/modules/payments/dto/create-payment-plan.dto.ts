// InfFinanceMs - 创建回款计划DTO

import { IsString, IsNumber, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentPlanDto {
  @ApiProperty({ description: '合同ID' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: '期数' })
  @IsNumber()
  @Min(1)
  period: number;

  @ApiProperty({ description: '计划回款金额' })
  @IsNumber()
  @Min(0)
  planAmount: number;

  @ApiProperty({ description: '计划回款日期' })
  @IsDateString()
  planDate: string;
}
