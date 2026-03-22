// InfFinanceMs - 报销控制器

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
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { QueryExpenseDto } from "./dto/query-expense.dto";
import { ApproveExpenseDto } from "./dto/approve-expense.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles, CurrentUser } from "../../common/decorators";

// 角色常量
const Role = {
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

@ApiTags("报销管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取报销列表" })
  async findAll(@Query() query: QueryExpenseDto, @CurrentUser() user: any) {
    return this.expensesService.findAll(query, user.id, user.role);
  }

  @Get(":id")
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取报销详情" })
  async findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.expensesService.findOne(id, user.id, user.role);
  }

  @Post()
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "创建报销单" })
  async create(
    @Body() createExpenseDto: CreateExpenseDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.create(
      createExpenseDto,
      user.id,
      user.department || "未分配",
    );
  }

  @Patch(":id")
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "更新报销单" })
  async update(
    @Param("id") id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @CurrentUser() user: any,
  ) {
    return this.expensesService.update(
      id,
      updateExpenseDto,
      user.id,
      user.role,
    );
  }

  @Patch(":id/submit")
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "提交报销单" })
  async submit(@Param("id") id: string, @CurrentUser() user: any) {
    return this.expensesService.submit(id, user.id, user.role);
  }

  @Patch(":id/approve")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "审批报销单" })
  async approve(
    @Param("id") id: string,
    @Body() approveDto: ApproveExpenseDto,
  ) {
    return this.expensesService.approve(id, approveDto);
  }

  @Patch(":id/pay")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "报销打款" })
  async pay(@Param("id") id: string) {
    return this.expensesService.pay(id);
  }

  @Delete(":id")
  @Roles(Role.EMPLOYEE, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "删除报销单" })
  async remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.expensesService.remove(id, user.id, user.role);
  }
}
