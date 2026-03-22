// InfFinanceMs - 银行账户控制器
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles, Role } from "../../common/decorators";
import { BankAccountsService } from "./bank-accounts.service";
import { CreateBankAccountDto } from "./dto/create-bank-account.dto";
import { UpdateBankAccountDto } from "./dto/update-bank-account.dto";

@ApiTags("银行账户")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("bank-accounts")
export class BankAccountsController {
  constructor(private readonly bankAccountsService: BankAccountsService) {}

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "创建银行账户" })
  @ApiResponse({ status: 201, description: "创建成功" })
  @ApiResponse({ status: 400, description: "银行账号已存在" })
  create(@Body() createDto: CreateBankAccountDto) {
    return this.bankAccountsService.create(createDto);
  }

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "查询银行账户列表" })
  @ApiQuery({
    name: "onlyEnabled",
    required: false,
    type: Boolean,
    description: "是否只查询启用的账户",
  })
  @ApiResponse({ status: 200, description: "查询成功" })
  findAll(@Query("onlyEnabled") onlyEnabled?: string) {
    return this.bankAccountsService.findAll(onlyEnabled !== "false");
  }

  @Get(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取银行账户详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "银行账户不存在" })
  findOne(@Param("id") id: string) {
    return this.bankAccountsService.findOne(id);
  }

  @Put(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "更新银行账户" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "银行账号已存在" })
  update(@Param("id") id: string, @Body() updateDto: UpdateBankAccountDto) {
    return this.bankAccountsService.update(id, updateDto);
  }

  @Post(":id/toggle-enabled")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "启用/禁用银行账户" })
  @ApiResponse({ status: 200, description: "操作成功" })
  toggleEnabled(@Param("id") id: string) {
    return this.bankAccountsService.toggleEnabled(id);
  }

  @Post(":id/set-default")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "设置默认账户" })
  @ApiResponse({ status: 200, description: "设置成功" })
  setDefault(@Param("id") id: string) {
    return this.bankAccountsService.setDefault(id);
  }

  @Delete(":id")
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "删除银行账户" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 400, description: "账户已关联付款申请，无法删除" })
  remove(@Param("id") id: string) {
    return this.bankAccountsService.remove(id);
  }
}
