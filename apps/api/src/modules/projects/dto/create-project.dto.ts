// InfFinanceMs - 创建项目DTO

import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 项目状态
const PROJECT_STATUS = ['ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUS[number];

export class CreateProjectDto {
  // 项目编号由系统自动生成，格式：TKFY + 年份(4位) + 顺序号(4位)
  // 例如：TKFY20250001

  @ApiProperty({ description: '项目名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '项目描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '项目状态', enum: PROJECT_STATUS, default: 'ACTIVE' })
  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
