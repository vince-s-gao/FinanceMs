// InfFinanceMs - 审批付款申请 DTO
import { IsString, IsNotEmpty, IsEnum, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PaymentRequestStatus } from "./query-payment-request.dto";

export class ApprovePaymentRequestDto {
  @ApiProperty({
    description: "审批结果",
    enum: [PaymentRequestStatus.APPROVED, PaymentRequestStatus.REJECTED],
  })
  @IsEnum([PaymentRequestStatus.APPROVED, PaymentRequestStatus.REJECTED], {
    message: "审批结果只能是 APPROVED 或 REJECTED",
  })
  @IsNotEmpty({ message: "审批结果不能为空" })
  status: PaymentRequestStatus.APPROVED | PaymentRequestStatus.REJECTED;

  @ApiPropertyOptional({ description: "审批备注" })
  @IsString()
  @IsOptional()
  approvalRemark?: string;
}

export class ConfirmPaymentDto {
  @ApiPropertyOptional({ description: "付款备注" })
  @IsString()
  @IsOptional()
  remark?: string;
}
