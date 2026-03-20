// InfFinanceMs - 创建供应商DTO

import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({ description: '供应商名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '供应商类型（数据字典编码）', example: 'CORPORATE' })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/, {
    message: '请输入有效的统一社会信用代码',
  })
  creditCode?: string;

  @ApiPropertyOptional({ description: '联系人' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: '联系邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  contactEmail?: string;

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '开户银行' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional({ description: '户名' })
  @IsOptional()
  @IsString()
  bankAccountName?: string;

  @ApiPropertyOptional({ description: '银行账号' })
  @IsOptional()
  @IsString()
  bankAccountNo?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

