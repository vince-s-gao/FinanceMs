// InfFinanceMs - 更新银行账户 DTO
import { PartialType } from "@nestjs/swagger";
import { CreateBankAccountDto } from "./create-bank-account.dto";

export class UpdateBankAccountDto extends PartialType(CreateBankAccountDto) {}
