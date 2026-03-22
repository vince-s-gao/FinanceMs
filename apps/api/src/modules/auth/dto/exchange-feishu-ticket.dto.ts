import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ExchangeFeishuTicketDto {
  @ApiProperty({ description: "一次性登录 ticket" })
  @IsString()
  @IsNotEmpty()
  ticket: string;
}
