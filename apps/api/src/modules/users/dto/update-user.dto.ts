// InfFinanceMs - 更新用户DTO

import { PartialType } from "@nestjs/swagger";
import { IsOptional, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: "是否启用" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "头像URL" })
  @IsOptional()
  avatar?: string;
}
