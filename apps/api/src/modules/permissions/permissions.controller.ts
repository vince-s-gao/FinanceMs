// InfFinanceMs - 权限控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

// 角色常量
const Role = {
  ADMIN: 'ADMIN',
} as const;

@ApiTags('权限管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('menus')
  @ApiOperation({ summary: '获取所有菜单定义' })
  async getAllMenus() {
    return this.permissionsService.getAllMenus();
  }

  @Get('functions')
  @ApiOperation({ summary: '获取所有功能定义' })
  async getAllFunctions() {
    return this.permissionsService.getAllFunctions();
  }

  @Get('roles')
  @ApiOperation({ summary: '获取所有角色的权限配置' })
  async getAllRolePermissions() {
    return this.permissionsService.getAllRolePermissions();
  }

  @Get('roles/:role')
  @ApiOperation({ summary: '获取指定角色的权限配置' })
  async getRolePermissions(@Param('role') role: string) {
    return this.permissionsService.getRolePermissions(role);
  }

  @Post('roles/:role')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新角色权限' })
  async updateRolePermissions(
    @Param('role') role: string,
    @Body() body: { menus: string[]; functions: string[] },
  ) {
    return this.permissionsService.updateRolePermissions(
      role,
      body.menus,
      body.functions,
    );
  }

  @Post('roles/:role/menus')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新角色菜单权限' })
  async updateRoleMenuPermissions(
    @Param('role') role: string,
    @Body() body: { menus: string[] },
  ) {
    return this.permissionsService.updateRoleMenuPermissions(role, body.menus);
  }

  @Post('roles/:role/functions')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新角色功能权限' })
  async updateRoleFunctionPermissions(
    @Param('role') role: string,
    @Body() body: { functions: string[] },
  ) {
    return this.permissionsService.updateRoleFunctionPermissions(role, body.functions);
  }

  @Post('roles/:role/reset')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '重置角色权限为默认值' })
  async resetRolePermissions(@Param('role') role: string) {
    return this.permissionsService.resetRolePermissions(role);
  }

  @Post('initialize')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '初始化默认权限配置' })
  async initializeDefaultPermissions() {
    return this.permissionsService.initializeDefaultPermissions();
  }
}
