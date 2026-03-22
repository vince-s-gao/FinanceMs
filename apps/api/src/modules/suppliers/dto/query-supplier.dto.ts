// InfFinanceMs - 查询供应商DTO

import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QuerySupplierDto extends PaginationDto {
  @ApiPropertyOptional({ description: "关键词搜索（名称、编号、联系人）" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: "供应商类型（字典编码）" })
  @IsOptional()
  @IsString()
  type?: string;
}
