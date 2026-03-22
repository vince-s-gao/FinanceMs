// InfFinanceMs - 客户控制器

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
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { QueryCustomerDto } from "./dto/query-customer.dto";
import { ApproveCustomerDto } from "./dto/approve-customer.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles, CurrentUser, Role } from "../../common/decorators";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { isSupportedTabularFile } from "../../common/utils/tabular.utils";
import { buildSingleFileInterceptorOptions } from "../../common/utils/upload.utils";

@ApiTags("客户管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("customers")
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  private buildFileName(prefix: string, ext: "csv" | "xlsx") {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${prefix}-${y}${m}${d}.${ext}`;
  }

  private sendCsv(res: Response, filename: string, csvContent: string) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(`\uFEFF${csvContent}`);
  }

  private sendExcel(res: Response, filename: string, buffer: Buffer) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(buffer);
  }

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取客户列表" })
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

  @Get("export/csv")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "批量导出客户（CSV）" })
  async exportCsv(@Query() query: QueryCustomerDto, @Res() res: Response) {
    const csv = await this.customersService.exportCsv(query);
    this.sendCsv(res, this.buildFileName("customers", "csv"), csv);
  }

  @Get("export/excel")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "批量导出客户（Excel）" })
  async exportExcel(@Query() query: QueryCustomerDto, @Res() res: Response) {
    const buffer = await this.customersService.exportExcel(query);
    this.sendExcel(res, this.buildFileName("customers", "xlsx"), buffer);
  }

  @Post("import")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @UseInterceptors(
    FileInterceptor(
      "file",
      buildSingleFileInterceptorOptions([".csv", ".xlsx", ".xls"]),
    ),
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
      },
      required: ["file"],
    },
  })
  @ApiOperation({ summary: "批量导入客户（CSV/Excel）" })
  async importCustomers(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException("请上传导入文件");
    }
    if (!isSupportedTabularFile(file.originalname)) {
      throw new BadRequestException("仅支持 CSV/Excel 文件（.csv/.xlsx/.xls）");
    }
    return this.customersService.importFile(
      file.buffer,
      file.originalname,
      user.id,
    );
  }

  @Get("options")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取客户选项列表" })
  async getOptions() {
    return this.customersService.getOptions();
  }

  @Get("pending-approval")
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取待审批客户列表" })
  async findPendingApproval(@Query() query: QueryCustomerDto) {
    return this.customersService.findPendingApproval(query);
  }

  @Get(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取客户详情" })
  async findOne(@Param("id") id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles(Role.SALES, Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "创建客户" })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.create(createCustomerDto, user.id);
  }

  @Patch(":id/approve")
  @Roles(Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "审批客户" })
  async approve(
    @Param("id") id: string,
    @Body() approveDto: ApproveCustomerDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.approve(id, approveDto, user.id);
  }

  @Patch(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "更新客户" })
  async update(
    @Param("id") id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ) {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "删除客户" })
  async remove(@Param("id") id: string) {
    return this.customersService.remove(id);
  }
}
