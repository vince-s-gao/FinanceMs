// InfFinanceMs - 查询合同DTO

import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 合同状态
const CONTRACT_STATUS = ['DRAFT', 'EXECUTING', 'COMPLETED', 'TERMINATED'] as const;
type ContractStatus = typeof CONTRACT_STATUS[number];

export class QueryContractDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词搜索（编号、名称、客户名称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '合同状态', enum: CONTRACT_STATUS })
  @IsOptional()
  @IsIn(CONTRACT_STATUS)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: '客户ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: '签订日期开始' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '签订日期结束' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
