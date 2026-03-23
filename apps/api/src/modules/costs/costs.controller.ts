// InfFinanceMs - 费用控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseGuards,
  Patch,
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
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { CostsService } from "./costs.service";
import { CreateCostDto } from "./dto/create-cost.dto";
import { QueryCostDto } from "./dto/query-cost.dto";
import { UpdateCostDto } from "./dto/update-cost.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Functions, Roles } from "../../common/decorators";
import { buildSingleFileInterceptorOptions } from "../../common/utils/upload.utils";
import { isSupportedTabularFile } from "../../common/utils/tabular.utils";

// 角色常量
const Role = {
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

@ApiTags("费用管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("costs")
export class CostsController {
  constructor(private readonly costsService: CostsService) {}

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
  @Functions("cost.view")
  @ApiOperation({ summary: "获取费用列表" })
  async findAll(@Query() query: QueryCostDto) {
    return this.costsService.findAll(query);
  }

  @Get("summary")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("cost.view")
  @ApiOperation({ summary: "获取费用汇总看板数据" })
  async getSummary(@Query() query: QueryCostDto) {
    return this.costsService.getSummary(query);
  }

  @Get("export/csv")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("cost.view")
  @ApiOperation({ summary: "导出费用（CSV）" })
  async exportCsv(@Query() query: QueryCostDto, @Res() res: Response) {
    const csv = await this.costsService.exportCsv(query);
    this.sendCsv(res, this.buildFileName("costs", "csv"), csv);
  }

  @Get("export/excel")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("cost.view")
  @ApiOperation({ summary: "导出费用（Excel）" })
  async exportExcel(@Query() query: QueryCostDto, @Res() res: Response) {
    const buffer = await this.costsService.exportExcel(query);
    this.sendExcel(res, this.buildFileName("costs", "xlsx"), buffer);
  }

  @Post("import")
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("cost.create")
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
  @ApiOperation({ summary: "批量导入费用（CSV/Excel）" })
  async importCosts(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException("请上传导入文件");
    }
    if (!isSupportedTabularFile(file.originalname)) {
      throw new BadRequestException("仅支持 CSV/Excel 文件（.csv/.xlsx/.xls）");
    }
    return this.costsService.importFile(file.buffer, file.originalname);
  }

  @Get("contract/:contractId")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("cost.view")
  @ApiOperation({ summary: "获取合同费用汇总" })
  async getContractCostSummary(@Param("contractId") contractId: string) {
    return this.costsService.getContractCostSummary(contractId);
  }

  @Get(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @Functions("cost.view")
  @ApiOperation({ summary: "获取费用详情" })
  async findOne(@Param("id") id: string) {
    return this.costsService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("cost.create")
  @ApiOperation({ summary: "创建费用（直接录入）" })
  async create(@Body() createCostDto: CreateCostDto) {
    return this.costsService.create(createCostDto);
  }

  @Patch(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("cost.edit")
  @ApiOperation({ summary: "更新费用（仅直接录入费用）" })
  async update(@Param("id") id: string, @Body() updateCostDto: UpdateCostDto) {
    return this.costsService.update(id, updateCostDto);
  }

  @Delete(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @Functions("cost.delete")
  @ApiOperation({ summary: "删除费用" })
  async remove(@Param("id") id: string) {
    return this.costsService.remove(id);
  }
}
