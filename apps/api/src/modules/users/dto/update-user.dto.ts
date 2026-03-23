// InfFinanceMs - 更新用户DTO

import { PartialType } from "@nestjs/swagger";
import { IsOptional, IsBoolean, IsString, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateUserDto } from "./create-user.dto";
import { Transform } from "class-transformer";

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ description: "是否启用" })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: "头像URL" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString({ message: "头像URL格式不正确" })
  @MaxLength(500, { message: "头像URL长度不能超过500个字符" })
  avatar?: string;
}
