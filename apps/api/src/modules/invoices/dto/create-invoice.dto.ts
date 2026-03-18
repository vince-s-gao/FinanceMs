// InfFinanceMs - 创建发票DTO

import { IsString, IsNumber, IsDateString, IsOptional, IsIn, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 发票类型
const INVOICE_TYPES = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT'] as const;
type InvoiceType = typeof INVOICE_TYPES[number];

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
}
