// InfFinanceMs - 预算控制器

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
import { BudgetsService } from "./budgets.service";
import { CreateBudgetDto } from "./dto/create-budget.dto";
import { UpdateBudgetDto } from "./dto/update-budget.dto";
import { QueryBudgetDto } from "./dto/query-budget.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles } from "../../common/decorators";

// 角色常量
const Role = {
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

@ApiTags("预算管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("budgets")
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取预算列表" })
  async findAll(@Query() query: QueryBudgetDto) {
    return this.budgetsService.findAll(query);
  }

  @Get("departments")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取部门列表" })
  async getDepartments() {
    return this.budgetsService.getDepartments();
  }

  @Get("summary/:year/:department")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取部门预算汇总" })
  async getDepartmentSummary(
    @Param("year") year: string,
    @Param("department") department: string,
  ) {
    return this.budgetsService.getDepartmentSummary(parseInt(year), department);
  }

  @Get(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取预算详情" })
  async findOne(@Param("id") id: string) {
    return this.budgetsService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "创建预算" })
  async create(@Body() createBudgetDto: CreateBudgetDto) {
    return this.budgetsService.create(createBudgetDto);
  }

  @Patch(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "更新预算" })
  async update(
    @Param("id") id: string,
    @Body() updateBudgetDto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, updateBudgetDto);
  }

  @Patch(":id/freeze")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "冻结/解冻预算" })
  async toggleFreeze(@Param("id") id: string) {
    return this.budgetsService.toggleFreeze(id);
  }

  @Patch(":id/close")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "关闭预算" })
  async close(@Param("id") id: string) {
    return this.budgetsService.close(id);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "删除预算" })
  async remove(@Param("id") id: string) {
    return this.budgetsService.remove(id);
  }
}
