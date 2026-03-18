// InfFinanceMs - 创建合同DTO

import { IsString, IsNumber, IsOptional, IsDateString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateContractDto {
  @ApiProperty({ description: '合同名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '客户ID' })
  @IsString()
  customerId: string;

  @ApiPropertyOptional({ description: '公司签约主体' })
  @IsOptional()
  @IsString()
  signingEntity?: string;

  @ApiPropertyOptional({ description: '合同类型（数据字典编码）', example: 'SERVICE' })
  @IsOptional()
  @IsString()
  contractType?: string;

  // 产品部分
  @ApiPropertyOptional({ description: '产品含税金额' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  productAmount?: number;

  @ApiPropertyOptional({ description: '产品税率', example: 13 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  productTaxRate?: number;

  // 服务部分
  @ApiPropertyOptional({ description: '服务含税金额' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceAmount?: number;

  @ApiPropertyOptional({ description: '服务税率', example: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceTaxRate?: number;

  @ApiProperty({ description: '含税总金额' })
  @IsNumber()
  @Min(0)
  amountWithTax: number;

  @ApiProperty({ description: '不含税总金额' })
  @IsNumber()
  @Min(0)
  amountWithoutTax: number;

  @ApiPropertyOptional({ description: '综合税率（兼容旧数据）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxRate?: number;

  // 合同附件
  @ApiProperty({ description: '附件URL（双章版合同扫描件）' })
  @IsString()
  attachmentUrl: string;

  @ApiPropertyOptional({ description: '附件文件名' })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiProperty({ description: '签订日期' })
  @IsDateString()
  signDate: string;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '结束日期' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
