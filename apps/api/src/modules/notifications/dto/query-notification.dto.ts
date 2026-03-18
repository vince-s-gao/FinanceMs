import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsOptional } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryNotificationDto extends PaginationDto {
  @ApiPropertyOptional({ description: '仅返回未读消息', example: 'true' })
  @IsOptional()
  @IsBooleanString()
  unreadOnly?: string;
}
