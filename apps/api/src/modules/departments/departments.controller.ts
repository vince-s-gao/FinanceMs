// InfFinanceMs - 部门控制器

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
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { QueryDepartmentDto } from './dto/query-department.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('部门管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门列表' })
  async findAll(@Query() query: QueryDepartmentDto) {
    return this.departmentsService.findAll(query);
  }

  @Get('tree')
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门树形结构' })
  async getTree() {
    return this.departmentsService.getTree();
  }

  @Get('options')
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门选项列表' })
  async getOptions() {
    return this.departmentsService.getOptions();
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门详情' })
  async findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建部门' })
  async create(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentsService.create(createDepartmentDto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新部门' })
  async update(@Param('id') id: string, @Body() updateDepartmentDto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, updateDepartmentDto);
  }

  @Patch(':id/toggle')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '启用/禁用部门' })
  async toggleActive(@Param('id') id: string) {
    return this.departmentsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '删除部门' })
  async remove(@Param('id') id: string) {
    return this.departmentsService.remove(id);
  }

  @Get(':id/members')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门成员列表' })
  async getMembers(@Param('id') id: string) {
    return this.departmentsService.getMembers(id);
  }

  @Get(':id/detail')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取部门详情（含成员）' })
  async findOneWithMembers(@Param('id') id: string) {
    return this.departmentsService.findOneWithMembers(id);
  }

  @Post(':id/members/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '添加部门成员' })
  async addMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.departmentsService.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '移除部门成员' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.departmentsService.removeMember(id, userId);
  }

  @Patch(':id/manager')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '设置部门负责人' })
  async setManager(@Param('id') id: string, @Body('userId') userId: string | null) {
    return this.departmentsService.setManager(id, userId);
  }
}
