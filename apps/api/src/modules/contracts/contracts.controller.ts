// InfFinanceMs - 合同控制器

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
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('合同管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同列表' })
  async findAll(@Query() query: QueryContractDto) {
    return this.contractsService.findAll(query);
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同详情' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建合同' })
  async create(@Body() createContractDto: CreateContractDto) {
    return this.contractsService.create(createContractDto);
  }

  @Patch(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '更新合同' })
  async update(@Param('id') id: string, @Body() updateContractDto: UpdateContractDto) {
    return this.contractsService.update(id, updateContractDto);
  }

  @Patch(':id/status')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '变更合同状态' })
  async changeStatus(@Param('id') id: string, @Body() changeStatusDto: ChangeStatusDto) {
    return this.contractsService.changeStatus(id, changeStatusDto);
  }

  @Delete(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除合同' })
  async remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }
}
