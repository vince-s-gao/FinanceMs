// InfFinanceMs - 更新付款申请 DTO
import { PartialType } from '@nestjs/swagger';
import { CreatePaymentRequestDto } from './create-payment-request.dto';

export class UpdatePaymentRequestDto extends PartialType(CreatePaymentRequestDto) {}
