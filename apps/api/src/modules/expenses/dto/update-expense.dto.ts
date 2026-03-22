// InfFinanceMs - 更新报销DTO

import { PartialType } from "@nestjs/swagger";
import { CreateExpenseDto } from "./create-expense.dto";

export class UpdateExpenseDto extends PartialType(CreateExpenseDto) {}
