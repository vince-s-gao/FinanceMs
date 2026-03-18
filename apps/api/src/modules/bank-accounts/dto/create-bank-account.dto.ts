// InfFinanceMs - 创建银行账户 DTO
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBankAccountDto {
  @ApiProperty({ description: '账户类型', enum: ['PERSONAL', 'CORPORATE'], default: 'PERSONAL' })
  @IsString()
  @IsOptional()
  accountType?: string = 'PERSONAL';

  @ApiProperty({ description: '户名（收款人姓名/公司名称）' })
  @IsString()
  @IsNotEmpty({ message: '户名不能为空' })
  accountName: string;

  @ApiProperty({ description: '银行账号' })
  @IsString()
  @IsNotEmpty({ message: '银行账号不能为空' })
  accountNo: string;

  @ApiPropertyOptional({ description: '银行代码' })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiProperty({ description: '开户银行' })
  @IsString()
  @IsNotEmpty({ message: '开户银行不能为空' })
  bankName: string;

  @ApiPropertyOptional({ description: '银行所在地区 [省, 市]' })
  @IsArray()
  @IsOptional()
  region?: string[];

  @ApiPropertyOptional({ description: '支行名称' })
  @IsString()
  @IsOptional()
  bankBranch?: string;

  @ApiPropertyOptional({ description: '币种', default: 'CNY' })
  @IsString()
  @IsOptional()
  currency?: string = 'CNY';

  @ApiPropertyOptional({ description: '是否默认账户', default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  remark?: string;
}
