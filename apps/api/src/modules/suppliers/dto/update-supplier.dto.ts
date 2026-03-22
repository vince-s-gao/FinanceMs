// InfFinanceMs - 更新供应商DTO

import { PartialType } from "@nestjs/swagger";
import { CreateSupplierDto } from "./create-supplier.dto";

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
