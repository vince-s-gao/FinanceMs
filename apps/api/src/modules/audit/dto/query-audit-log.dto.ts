import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const AUDIT_ACTIONS = ['LOGIN', 'CREATE', 'UPDATE', 'DELETE'] as const;

export class QueryAuditLogDto extends PaginationDto {
  @ApiPropertyOptional({ description: '操作类型', enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @ApiPropertyOptional({ description: '实体类型' })
  @IsOptional()
  @IsString()
  entityType?: string;

  @ApiPropertyOptional({ description: '操作人ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '关键字（匹配实体ID/操作人姓名/邮箱）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '开始日期（ISO）' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期（ISO）' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export const AUDIT_ACTION_OPTIONS = AUDIT_ACTIONS;

