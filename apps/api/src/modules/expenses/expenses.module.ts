// InfFinanceMs - 报销模块

import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { CostsModule } from '../costs/costs.module';
import { BudgetsModule } from '../budgets/budgets.module';

@Module({
  imports: [CostsModule, BudgetsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
