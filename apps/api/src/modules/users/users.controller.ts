// InfFinanceMs - 用户控制器

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
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { CurrentUser, Roles } from "../../common/decorators";

// 角色常量
const Role = {
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

@ApiTags("用户管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "获取用户列表" })
  async findAll(
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("role") role?: string,
    @Query("isActive") isActive?: string,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedPageSize = pageSize ? Number(pageSize) : undefined;
    const parsedIsActive =
      isActive === undefined
        ? undefined
        : String(isActive).toLowerCase() === "true";

    return this.usersService.findAll({
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      pageSize: Number.isFinite(parsedPageSize) ? parsedPageSize : undefined,
      role,
      isActive: parsedIsActive,
    });
  }

  @Get("options")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取用户选项列表（用于下拉选择）" })
  async getOptions() {
    return this.usersService.getOptions();
  }

  @Get(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "获取用户详情" })
  async findOne(@Param("id") id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "创建用户" })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Patch(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "更新用户" })
  async update(@Param("id") id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "删除用户" })
  async remove(
    @Param("id") id: string,
    @CurrentUser("id") operatorId?: string,
  ) {
    return this.usersService.remove(id, operatorId);
  }
}
