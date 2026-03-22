// InfFinanceMs - 创建数据字典 DTO

import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsBoolean, IsInt, Min } from "class-validator";

export class CreateDictionaryDto {
  @ApiProperty({ description: "字典类型", example: "CUSTOMER_TYPE" })
  @IsString()
  type: string;

  @ApiProperty({ description: "字典编码", example: "ENTERPRISE" })
  @IsString()
  code: string;

  @ApiProperty({ description: "字典名称/显示值", example: "企业" })
  @IsString()
  name: string;

  @ApiProperty({ description: "字典值", required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ description: "显示颜色", required: false, example: "blue" })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: "排序", required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiProperty({ description: "是否默认值", required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ description: "是否启用", required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiProperty({ description: "备注", required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
