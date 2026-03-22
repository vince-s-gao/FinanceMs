// InfFinanceMs - 付款申请模块
import { Module } from "@nestjs/common";
import { PaymentRequestsController } from "./payment-requests.controller";
import { PaymentRequestsService } from "./payment-requests.service";
import { PrismaModule } from "../../prisma/prisma.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [PaymentRequestsController],
  providers: [PaymentRequestsService],
  exports: [PaymentRequestsService],
})
export class PaymentRequestsModule {}
