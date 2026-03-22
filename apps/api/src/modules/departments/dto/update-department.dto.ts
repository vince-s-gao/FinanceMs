// InfFinanceMs - 更新部门DTO

import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateDepartmentDto {
  @ApiPropertyOptional({ description: "部门名称" })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: "上级部门ID" })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: "部门负责人ID" })
  @IsOptional()
  @IsString()
  managerId?: string;

  @ApiPropertyOptional({ description: "排序" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: "是否启用" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "备注" })
  @IsOptional()
  @IsString()
  remark?: string;
}
