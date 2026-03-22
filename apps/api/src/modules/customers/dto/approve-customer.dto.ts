import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString } from "class-validator";

/**
 * 审批客户 DTO
 */
export class ApproveCustomerDto {
  @ApiProperty({ description: "是否通过审批", example: true })
  @IsBoolean()
  approved: boolean;

  @ApiProperty({ description: "审批备注", required: false })
  @IsOptional()
  @IsString()
  remark?: string;
}
