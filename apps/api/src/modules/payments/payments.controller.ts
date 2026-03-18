// InfFinanceMs - 回款控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('回款管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get('statistics')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取回款统计数据' })
  async getStatistics() {
    return this.paymentsService.getStatistics();
  }

  @Get('plans/:contractId')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同回款计划' })
  async findPlansByContract(@Param('contractId') contractId: string) {
    return this.paymentsService.findPlansByContract(contractId);
  }

  @Get('records/:contractId')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同回款记录' })
  async findRecordsByContract(@Param('contractId') contractId: string) {
    return this.paymentsService.findRecordsByContract(contractId);
  }

  @Post('plans')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建回款计划' })
  async createPlan(@Body() createPlanDto: CreatePaymentPlanDto) {
    return this.paymentsService.createPlan(createPlanDto);
  }

  @Post('plans/batch/:contractId')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '批量创建回款计划' })
  async createPlans(
    @Param('contractId') contractId: string,
    @Body() plans: CreatePaymentPlanDto[],
  ) {
    return this.paymentsService.createPlans(contractId, plans);
  }

  @Post('records')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建回款记录' })
  async createRecord(@Body() createRecordDto: CreatePaymentRecordDto) {
    return this.paymentsService.createRecord(createRecordDto);
  }

  @Delete('plans/:id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除回款计划' })
  async removePlan(@Param('id') id: string) {
    return this.paymentsService.removePlan(id);
  }

  @Delete('records/:id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除回款记录' })
  async removeRecord(@Param('id') id: string) {
    return this.paymentsService.removeRecord(id);
  }
}
