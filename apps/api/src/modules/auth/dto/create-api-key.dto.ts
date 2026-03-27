import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateApiKeyDto {
  @ApiProperty({ description: "API 密钥名称", example: "报表同步服务" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: "API 密钥名称不能为空" })
  @MaxLength(50, { message: "API 密钥名称长度不能超过50" })
  name: string;

  @ApiProperty({
    description: "过期天数（1-365），不传表示不过期",
    required: false,
    example: 90,
  })
  @IsOptional()
  @IsInt({ message: "过期天数必须是整数" })
  @Min(1, { message: "过期天数至少为1天" })
  @Max(365, { message: "过期天数最多为365天" })
  expiresInDays?: number;
}
