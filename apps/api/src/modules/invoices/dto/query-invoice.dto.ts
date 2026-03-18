// InfFinanceMs - 查询发票DTO

import { IsOptional, IsString, IsIn, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

// 发票类型
const INVOICE_TYPES = ['VAT_SPECIAL', 'VAT_NORMAL', 'RECEIPT'] as const;
type InvoiceType = typeof INVOICE_TYPES[number];

// 发票状态
const INVOICE_STATUS = ['ISSUED', 'VOIDED'] as const;
type InvoiceStatus = typeof INVOICE_STATUS[number];

export class QueryInvoiceDto extends PaginationDto {
  @ApiPropertyOptional({ description: '关键词搜索（发票号、合同编号、合同名称）' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '合同ID' })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: '发票类型', enum: INVOICE_TYPES })
  @IsOptional()
  @IsIn(INVOICE_TYPES)
  invoiceType?: InvoiceType;

  @ApiPropertyOptional({ description: '发票状态', enum: INVOICE_STATUS })
  @IsOptional()
  @IsIn(INVOICE_STATUS)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: '开票日期开始' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: '开票日期结束' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
