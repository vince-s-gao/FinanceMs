// InfFinanceMs - 根模块

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { CostsModule } from './modules/costs/costs.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DictionariesModule } from './modules/dictionaries/dictionaries.module';
import { UploadModule } from './modules/upload/upload.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { PaymentRequestsModule } from './modules/payment-requests/payment-requests.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { AuditModule } from './modules/audit/audit.module';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // 静态文件服务（用于访问上传的文件）
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
    // Prisma数据库模块
    PrismaModule,
    // 业务模块
    AuthModule,
    UsersModule,
    CustomersModule,
    ContractsModule,
    PaymentsModule,
    InvoicesModule,
    ExpensesModule,
    CostsModule,
    ReportsModule,
    BudgetsModule,
    DepartmentsModule,
    PermissionsModule,
    DictionariesModule,
    UploadModule,
    ProjectsModule,
    PaymentRequestsModule,  // 付款申请模块
    BankAccountsModule,     // 银行账户模块
    AuditModule,            // 审计日志模块
    NotificationsModule,    // 消息通知模块
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
