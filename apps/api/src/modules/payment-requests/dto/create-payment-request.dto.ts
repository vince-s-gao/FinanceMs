// InfFinanceMs - 创建付款申请 DTO
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

// 付款方式枚举
export enum PaymentRequestMethod {
  TRANSFER = "TRANSFER", // 银行转账
  CASH = "CASH", // 现金
  CHECK = "CHECK", // 支票
  DRAFT = "DRAFT", // 汇票
  OTHER = "OTHER", // 其他
}

// 附件信息
export class AttachmentDto {
  @ApiProperty({ description: "文件名" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: "文件URL" })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ description: "文件大小（字节）" })
  @IsNumber()
  @IsOptional()
  size?: number;
}

export class CreatePaymentRequestDto {
  @ApiProperty({ description: "关联项目ID" })
  @IsString()
  @IsNotEmpty({ message: "请选择关联项目" })
  projectId: string;

  @ApiProperty({ description: "关联合同ID（仅支持采购合同）" })
  @IsString()
  @IsNotEmpty({ message: "请选择采购合同" })
  contractId: string;

  @ApiProperty({ description: "付款事由" })
  @IsString()
  @IsNotEmpty({ message: "付款事由不能为空" })
  reason: string;

  @ApiProperty({ description: "付款金额" })
  @IsNumber()
  @Min(0.01, { message: "付款金额必须大于0" })
  amount: number;

  @ApiPropertyOptional({ description: "币种", default: "CNY" })
  @IsString()
  @IsOptional()
  currency?: string = "CNY";

  @ApiProperty({ description: "付款方式", enum: PaymentRequestMethod })
  @IsEnum(PaymentRequestMethod, { message: "请选择有效的付款方式" })
  paymentMethod: PaymentRequestMethod;

  @ApiProperty({ description: "付款日期" })
  @IsDateString({}, { message: "请输入有效的日期格式" })
  paymentDate: string;

  @ApiProperty({ description: "银行账户ID" })
  @IsString()
  @IsNotEmpty({ message: "请选择银行账户" })
  bankAccountId: string;

  @ApiPropertyOptional({ description: "收款方名称" })
  @IsString()
  @IsOptional()
  payeeName?: string;

  @ApiPropertyOptional({ description: "收款方账号" })
  @IsString()
  @IsOptional()
  payeeAccount?: string;

  @ApiPropertyOptional({ description: "收款方开户行" })
  @IsString()
  @IsOptional()
  payeeBank?: string;

  @ApiPropertyOptional({ description: "附件列表", type: [AttachmentDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  @IsOptional()
  attachments?: AttachmentDto[];

  @ApiPropertyOptional({ description: "备注" })
  @IsString()
  @IsOptional()
  remark?: string;
}
