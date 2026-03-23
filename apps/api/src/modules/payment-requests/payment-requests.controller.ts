// InfFinanceMs - 付款申请控制器
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
} from "@nestjs/swagger";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Functions, Roles, CurrentUser, Role } from "../../common/decorators";
import { PaymentRequestsService } from "./payment-requests.service";
import { CreatePaymentRequestDto } from "./dto/create-payment-request.dto";
import { UpdatePaymentRequestDto } from "./dto/update-payment-request.dto";
import { QueryPaymentRequestDto } from "./dto/query-payment-request.dto";
import {
  ApprovePaymentRequestDto,
  ConfirmPaymentDto,
} from "./dto/approve-payment-request.dto";
import type { AuthenticatedUser } from "../../common/types/auth-user.type";

@ApiTags("付款申请")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("payment-requests")
export class PaymentRequestsController {
  constructor(
    private readonly paymentRequestsService: PaymentRequestsService,
  ) {}

  @Post()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.create")
  @ApiOperation({ summary: "创建付款申请" })
  @ApiResponse({ status: 201, description: "创建成功" })
  create(
    @Body() createDto: CreatePaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.create(createDto, user.id);
  }

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.view")
  @ApiOperation({ summary: "查询付款申请列表" })
  @ApiResponse({ status: 200, description: "查询成功" })
  findAll(@Query() query: QueryPaymentRequestDto) {
    return this.paymentRequestsService.findAll(query);
  }

  @Get("statistics")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.view")
  @ApiOperation({ summary: "获取付款申请统计" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getStatistics() {
    return this.paymentRequestsService.getStatistics();
  }

  @Get("purchase-contract-options")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.view")
  @ApiOperation({ summary: "获取采购合同选项（用于付款申请关联）" })
  @ApiResponse({ status: 200, description: "获取成功" })
  getPurchaseContractOptions(@Query("keyword") keyword?: string) {
    return this.paymentRequestsService.getPurchaseContractOptions(keyword);
  }

  @Get(":id([a-z0-9]{10,})")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.view")
  @ApiOperation({ summary: "获取付款申请详情" })
  @ApiResponse({ status: 200, description: "获取成功" })
  @ApiResponse({ status: 404, description: "付款申请不存在" })
  findOne(@Param("id") id: string) {
    return this.paymentRequestsService.findOne(id);
  }

  @Put(":id([a-z0-9]{10,})")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.edit")
  @ApiOperation({ summary: "更新付款申请" })
  @ApiResponse({ status: 200, description: "更新成功" })
  @ApiResponse({ status: 400, description: "只有草稿状态可以修改" })
  update(@Param("id") id: string, @Body() updateDto: UpdatePaymentRequestDto) {
    return this.paymentRequestsService.update(id, updateDto);
  }

  @Post(":id([a-z0-9]{10,})/submit")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.submit")
  @ApiOperation({ summary: "提交付款申请" })
  @ApiResponse({ status: 200, description: "提交成功" })
  @ApiResponse({ status: 400, description: "只有草稿状态可以提交" })
  submit(@Param("id") id: string) {
    return this.paymentRequestsService.submit(id);
  }

  @Post(":id([a-z0-9]{10,})/approve")
  @Roles(Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.approve")
  @ApiOperation({ summary: "审批付款申请" })
  @ApiResponse({ status: 200, description: "审批成功" })
  @ApiResponse({ status: 400, description: "只有待审批状态可以审批" })
  approve(
    @Param("id") id: string,
    @Body() approveDto: ApprovePaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentRequestsService.approve(id, approveDto, user.id);
  }

  @Post(":id([a-z0-9]{10,})/confirm-payment")
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("payment-request.confirm")
  @ApiOperation({ summary: "确认付款" })
  @ApiResponse({ status: 200, description: "确认成功" })
  @ApiResponse({ status: 400, description: "只有已通过的申请可以确认付款" })
  confirmPayment(@Param("id") id: string, @Body() dto: ConfirmPaymentDto) {
    return this.paymentRequestsService.confirmPayment(id, dto.remark);
  }

  @Post(":id([a-z0-9]{10,})/cancel")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("payment-request.cancel")
  @ApiOperation({ summary: "取消付款申请" })
  @ApiResponse({ status: 200, description: "取消成功" })
  @ApiResponse({ status: 400, description: "只有草稿或待审批状态可以取消" })
  cancel(@Param("id") id: string) {
    return this.paymentRequestsService.cancel(id);
  }

  @Delete(":id([a-z0-9]{10,})")
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("payment-request.delete")
  @ApiOperation({ summary: "删除付款申请" })
  @ApiResponse({ status: 200, description: "删除成功" })
  @ApiResponse({ status: 400, description: "只有草稿状态可以删除" })
  remove(@Param("id") id: string) {
    return this.paymentRequestsService.remove(id);
  }
}
