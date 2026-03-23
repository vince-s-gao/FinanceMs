// InfFinanceMs - 创建用户DTO

import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

// 角色枚举值
const ROLES = ["EMPLOYEE", "FINANCE", "MANAGER", "ADMIN"] as const;
type Role = (typeof ROLES)[number];

export class CreateUserDto {
  @ApiProperty({ description: "邮箱" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: "邮箱不能为空" })
  @IsEmail({}, { message: "请输入有效的邮箱地址" })
  @MaxLength(100, { message: "邮箱长度不能超过100个字符" })
  email: string;

  @ApiProperty({ description: "密码" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "密码不能为空" })
  @MinLength(8, { message: "密码长度不能少于8位" })
  @MaxLength(64, { message: "密码长度不能超过64位" })
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, {
    message: "密码必须包含大小写字母、数字和特殊字符",
  })
  password: string;

  @ApiProperty({ description: "姓名" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "姓名不能为空" })
  @MaxLength(50, { message: "姓名长度不能超过50个字符" })
  name: string;

  @ApiPropertyOptional({ description: "手机号" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(20, { message: "手机号长度不能超过20个字符" })
  phone?: string;

  @ApiPropertyOptional({ description: "角色", enum: ROLES })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @ApiPropertyOptional({ description: "部门ID" })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(50, { message: "部门ID长度不能超过50个字符" })
  departmentId?: string;
}
