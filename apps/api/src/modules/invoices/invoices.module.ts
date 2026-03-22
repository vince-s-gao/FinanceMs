// InfFinanceMs - 发票模块

import { Module } from "@nestjs/common";
import { InvoicesService } from "./invoices.service";
import { InvoicesController } from "./invoices.controller";
import { UploadModule } from "../upload/upload.module";

@Module({
  imports: [UploadModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
