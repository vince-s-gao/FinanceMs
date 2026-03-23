// InfFinanceMs - 登录DTO

import {
  IsEmail,
  IsString,
  MinLength,
  IsNotEmpty,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class LoginDto {
  @ApiProperty({ description: "邮箱", example: "admin@inffinancems.com" })
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsNotEmpty({ message: "邮箱不能为空" })
  @IsEmail({}, { message: "请输入有效的邮箱地址" })
  @MaxLength(100, { message: "邮箱长度不能超过100个字符" })
  email: string;

  @ApiProperty({ description: "密码", example: "Admin@123" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "密码不能为空" })
  @MinLength(8, { message: "密码长度不能少于8位" })
  @MaxLength(64, { message: "密码长度不能超过64位" })
  password: string;
}
