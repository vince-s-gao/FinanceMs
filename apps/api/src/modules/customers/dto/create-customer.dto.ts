// InfFinanceMs - 创建客户DTO

import { IsString, IsOptional, IsEmail, Matches } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCustomerDto {
  @ApiProperty({ description: "客户名称" })
  @IsString()
  name: string;

  @ApiProperty({
    description: "客户类型（数据字典编码）",
    example: "ENTERPRISE",
  })
  @IsString()
  type: string;

  @ApiPropertyOptional({ description: "统一社会信用代码" })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/, {
    message: "请输入有效的统一社会信用代码",
  })
  creditCode?: string;

  @ApiPropertyOptional({ description: "联系人姓名" })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ description: "联系电话" })
  @IsOptional()
  @IsString()
  @Matches(/^1[3-9]\d{9}$/, { message: "请输入有效的手机号" })
  contactPhone?: string;

  @ApiPropertyOptional({ description: "联系邮箱" })
  @IsOptional()
  @IsEmail({}, { message: "请输入有效的邮箱地址" })
  contactEmail?: string;

  @ApiPropertyOptional({ description: "地址" })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: "备注" })
  @IsOptional()
  @IsString()
  remark?: string;
}
