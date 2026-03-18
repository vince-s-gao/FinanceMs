// InfFinanceMs - 报表控制器

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('报表看板')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('receivables')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '应收账款总览' })
  async getReceivablesOverview() {
    return this.reportsService.getReceivablesOverview();
  }

  @Get('customers')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '客户维度报表' })
  async getCustomerReport() {
    return this.reportsService.getCustomerReport();
  }

  @Get('expenses')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '报销分析' })
  async getExpenseAnalysis() {
    return this.reportsService.getExpenseAnalysis();
  }

  @Get('contracts/dashboard')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '合同执行看板' })
  async getContractDashboard() {
    return this.reportsService.getContractDashboard();
  }

  @Get('contracts')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '合同执行看板（兼容端点）' })
  async getContractDashboardCompat() {
    return this.reportsService.getContractDashboard();
  }

  @Get('contracts/profit')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '合同毛利分析' })
  async getContractProfitAnalysis(@Query('contractId') contractId?: string) {
    return this.reportsService.getContractProfitAnalysis(contractId);
  }
}
