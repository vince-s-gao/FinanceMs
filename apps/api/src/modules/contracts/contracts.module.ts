// InfFinanceMs - 合同模块

import { Module } from "@nestjs/common";
import { ContractsService } from "./contracts.service";
import { ContractsController } from "./contracts.controller";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [UploadModule],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
