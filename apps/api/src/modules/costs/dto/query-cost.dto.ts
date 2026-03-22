// InfFinanceMs - 查询费用DTO

import { IsOptional, IsString, IsIn, IsDateString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { PaginationDto } from "../../../common/dto/pagination.dto";
import { COST_SOURCES, FEE_TYPES } from "@inffinancems/shared";

type FeeType = (typeof FEE_TYPES)[number];
type CostSource = (typeof COST_SOURCES)[number];

export class QueryCostDto extends PaginationDto {
  @ApiPropertyOptional({ description: "关键词（费用说明/项目/合同/报销单号）" })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: "费用类型", enum: FEE_TYPES })
  @IsOptional()
  @IsIn(FEE_TYPES)
  feeType?: FeeType;

  @ApiPropertyOptional({ description: "费用来源", enum: COST_SOURCES })
  @IsOptional()
  @IsIn(COST_SOURCES)
  source?: CostSource;

  @ApiPropertyOptional({ description: "项目ID" })
  @IsOptional()
  @IsString()
  projectId?: string;

  @ApiPropertyOptional({ description: "合同ID" })
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiPropertyOptional({ description: "发生日期开始" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "发生日期结束" })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
