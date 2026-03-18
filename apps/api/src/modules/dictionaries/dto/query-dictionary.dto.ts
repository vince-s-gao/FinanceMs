// InfFinanceMs - 查询数据字典 DTO

import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryDictionaryDto {
  @ApiProperty({ description: '字典类型', required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ description: '是否启用', required: false })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isEnabled?: boolean;
}
