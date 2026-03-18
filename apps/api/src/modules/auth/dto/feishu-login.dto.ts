// InfFinanceMs - 飞书登录DTO

import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FeishuLoginDto {
  @ApiProperty({ description: '飞书授权码' })
  @IsString()
  code: string;
}

export class FeishuCallbackDto {
  @ApiProperty({ description: '飞书授权码' })
  @IsString()
  code: string;

  @ApiProperty({ description: '状态参数（防CSRF）' })
  @IsString()
  state: string;
}
