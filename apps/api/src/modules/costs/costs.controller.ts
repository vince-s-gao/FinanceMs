// InfFinanceMs - 费用控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CostsService } from './costs.service';
import { CreateCostDto } from './dto/create-cost.dto';
import { QueryCostDto } from './dto/query-cost.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('费用管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('costs')
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取费用列表' })
  async findAll(@Query() query: QueryCostDto) {
    return this.costsService.findAll(query);
  }

  @Get('contract/:contractId')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同费用汇总' })
  async getContractCostSummary(@Param('contractId') contractId: string) {
    return this.costsService.getContractCostSummary(contractId);
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取费用详情' })
  async findOne(@Param('id') id: string) {
    return this.costsService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建费用（直接录入）' })
  async create(@Body() createCostDto: CreateCostDto) {
    return this.costsService.create(createCostDto);
  }

  @Delete(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除费用' })
  async remove(@Param('id') id: string) {
    return this.costsService.remove(id);
  }
}
