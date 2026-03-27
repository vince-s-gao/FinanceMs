import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNotEmpty, Matches } from "class-validator";

export class MfaCodeDto {
  @ApiProperty({ description: "6位动态验证码", example: "123456" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsNotEmpty({ message: "验证码不能为空" })
  @Matches(/^\d{6}$/, { message: "验证码格式不正确" })
  code: string;
}
