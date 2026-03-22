// InfFinanceMs - 更新数据字典 DTO

import { PartialType } from "@nestjs/swagger";
import { CreateDictionaryDto } from "./create-dictionary.dto";

export class UpdateDictionaryDto extends PartialType(CreateDictionaryDto) {}
