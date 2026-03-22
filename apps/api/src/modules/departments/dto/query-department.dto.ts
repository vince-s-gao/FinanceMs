// InfFinanceMs - 查询部门DTO

import { IsOptional, IsString, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { PaginationDto } from "../../../common/dto/pagination.dto";

export class QueryDepartmentDto extends PaginationDto {
  @ApiPropertyOptional({ description: "关键词搜索（编号、名称）" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: "是否启用" })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  isActive?: boolean;
}
