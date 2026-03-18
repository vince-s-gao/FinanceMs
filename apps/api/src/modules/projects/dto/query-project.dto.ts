// InfFinanceMs - 查询项目DTO

import { IsOptional, IsString, IsInt, Min, IsIn, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

// 项目状态
const PROJECT_STATUS = ['ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUS[number];

const PROJECT_SORT_FIELDS = [
  'code',
  'name',
  'status',
  'startDate',
  'endDate',
  'createdAt',
  'updatedAt',
] as const;
type ProjectSortField = typeof PROJECT_SORT_FIELDS[number];

export class QueryProjectDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '项目状态', enum: PROJECT_STATUS })
  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '排序字段', enum: PROJECT_SORT_FIELDS, default: 'createdAt' })
  @IsOptional()
  @IsIn(PROJECT_SORT_FIELDS)
  sortBy?: ProjectSortField;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
