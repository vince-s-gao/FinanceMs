// InfFinanceMs - 查询合同DTO

import { IsOptional, IsString, IsIn, IsDateString, IsInt, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 合同状态
const CONTRACT_STATUS = ['DRAFT', 'EXECUTING', 'COMPLETED', 'TERMINATED'] as const;
type ContractStatus = typeof CONTRACT_STATUS[number];

export class QueryContractDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词搜索（合同编号、合同名称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '客户名称模糊搜索' })
  @IsOptional()
  @IsString()
  customerKeyword?: string;

  @ApiPropertyOptional({ description: '签约年份', example: 2026 })
  @IsOptional()
  @IsInt()
  @Min(2000)
  signYear?: number;

  @ApiPropertyOptional({ description: '合同类型（数据字典编码）', example: 'SERVICE' })
  @IsOptional()
  @IsString()
  contractType?: string;

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
