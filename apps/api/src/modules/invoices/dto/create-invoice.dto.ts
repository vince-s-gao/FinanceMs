// InfFinanceMs - 创建发票DTO

import { IsString, IsNumber, IsDateString, IsOptional, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 发票类型
const INVOICE_TYPES = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT'] as const;
type InvoiceType = typeof INVOICE_TYPES[number];
const INVOICE_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
type InvoiceDirection = typeof INVOICE_DIRECTIONS[number];

export class CreateInvoiceDto {
  @ApiProperty({ description: '合同ID' })
  @IsString()
  contractId: string;

  @ApiProperty({ description: '发票号码' })
  @IsString()
  invoiceNo: string;

  @ApiProperty({ description: '发票类型', enum: INVOICE_TYPES })
  @IsIn(INVOICE_TYPES)
  invoiceType: InvoiceType;

  @ApiProperty({ description: '发票金额' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ description: '税额' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxAmount?: number;

  @ApiProperty({ description: '开票日期' })
  @IsDateString()
  invoiceDate: string;

  @ApiPropertyOptional({ description: '附件URL' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: '附件文件名' })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({
    description: '期望发票方向（用于按模块校验合同匹配，不入库）',
    enum: INVOICE_DIRECTIONS,
  })
  @IsOptional()
  @IsIn(INVOICE_DIRECTIONS)
  expectedDirection?: InvoiceDirection;
}
