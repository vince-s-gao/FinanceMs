// InfFinanceMs - 变更合同状态DTO

import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 合同状态
const CONTRACT_STATUS = ['DRAFT', 'EXECUTING', 'COMPLETED', 'TERMINATED'] as const;
type ContractStatus = typeof CONTRACT_STATUS[number];

export class ChangeStatusDto {
  @ApiProperty({ description: '目标状态', enum: CONTRACT_STATUS })
  @IsIn(CONTRACT_STATUS)
  status: ContractStatus;

  @ApiPropertyOptional({ description: '变更原因' })
  @IsOptional()
  @IsString()
  reason?: string;
}
