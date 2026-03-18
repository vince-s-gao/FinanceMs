// InfFinanceMs - 客户控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser, Role } from '../../common/decorators';

@ApiTags('客户管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取客户列表' })
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

  @Get('options')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取客户选项列表' })
  async getOptions() {
    return this.customersService.getOptions();
  }

  @Get('pending-approval')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取待审批客户列表' })
  async findPendingApproval(@Query() query: QueryCustomerDto) {
    return this.customersService.findPendingApproval(query);
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取客户详情' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles(Role.SALES, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建客户' })
  async create(@Body() createCustomerDto: CreateCustomerDto, @CurrentUser() user: any) {
    return this.customersService.create(createCustomerDto, user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '审批客户' })
  async approve(@Param('id') id: string, @Body() approveDto: ApproveCustomerDto, @CurrentUser() user: any) {
    return this.customersService.approve(id, approveDto, user.id);
  }

  @Patch(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '更新客户' })
  async update(@Param('id') id: string, @Body() updateCustomerDto: UpdateCustomerDto) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除客户' })
  async remove(@Param('id') id: string) {
    return this.customersService.remove(id);
  }
}
