// InfFinanceMs - 数据字典控制器

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
import { DictionariesService } from './dictionaries.service';
import { CreateDictionaryDto } from './dto/create-dictionary.dto';
import { UpdateDictionaryDto } from './dto/update-dictionary.dto';
import { QueryDictionaryDto } from './dto/query-dictionary.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, Role } from '../../common/decorators';

@ApiTags('数据字典')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dictionaries')
export class DictionariesController {
  constructor(private readonly dictionariesService: DictionariesService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取字典列表' })
  async findAll(@Query() query: QueryDictionaryDto) {
    return this.dictionariesService.findAll(query);
  }

  @Get('types')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取所有字典类型' })
  async getTypes() {
    return this.dictionariesService.getTypes();
  }

  @Get('by-type/:type')
  @Roles(Role.EMPLOYEE, Role.SALES, Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '根据类型获取字典列表（用于下拉选择）' })
  async findByType(@Param('type') type: string) {
    return this.dictionariesService.findByType(type);
  }

  @Get(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取字典详情' })
  async findOne(@Param('id') id: string) {
    return this.dictionariesService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建字典项' })
  async create(@Body() createDto: CreateDictionaryDto) {
    return this.dictionariesService.create(createDto);
  }

  @Post('init-customer-types')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '初始化默认客户类型' })
  async initCustomerTypes() {
    return this.dictionariesService.initCustomerTypes();
  }

  @Post('init-expense-types')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '初始化默认报销类型' })
  async initExpenseTypes() {
    return this.dictionariesService.initExpenseTypes();
  }

  @Post('init-contract-types')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '初始化默认合同类型' })
  async initContractTypes() {
    return this.dictionariesService.initContractTypes();
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新字典项' })
  async update(@Param('id') id: string, @Body() updateDto: UpdateDictionaryDto) {
    return this.dictionariesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除字典项' })
  async remove(@Param('id') id: string) {
    return this.dictionariesService.remove(id);
  }
}
