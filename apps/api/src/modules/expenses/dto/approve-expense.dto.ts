// InfFinanceMs - 审批报销DTO

import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveExpenseDto {
  @ApiProperty({ description: '是否通过' })
  @IsBoolean()
  approved: boolean;

  @ApiPropertyOptional({ description: '驳回原因（驳回时必填）' })
  @IsOptional()
  @IsString()
  rejectReason?: string;
}
