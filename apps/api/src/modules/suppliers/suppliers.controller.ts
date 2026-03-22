// InfFinanceMs - 供应商控制器

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
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { QuerySupplierDto } from "./dto/query-supplier.dto";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles, Role } from "../../common/decorators";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { isSupportedTabularFile } from "../../common/utils/tabular.utils";
import { buildSingleFileInterceptorOptions } from "../../common/utils/upload.utils";

@ApiTags("供应商管理")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("suppliers")
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

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
  @ApiOperation({ summary: "获取供应商列表" })
  async findAll(@Query() query: QuerySupplierDto) {
    return this.suppliersService.findAll(query);
  }

  @Get("export/csv")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "批量导出供应商（CSV）" })
  async exportCsv(@Query() query: QuerySupplierDto, @Res() res: Response) {
    const csv = await this.suppliersService.exportCsv(query);
    this.sendCsv(res, this.buildFileName("suppliers", "csv"), csv);
  }

  @Get("export/excel")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "批量导出供应商（Excel）" })
  async exportExcel(@Query() query: QuerySupplierDto, @Res() res: Response) {
    const buffer = await this.suppliersService.exportExcel(query);
    this.sendExcel(res, this.buildFileName("suppliers", "xlsx"), buffer);
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
  @ApiOperation({ summary: "批量导入供应商（CSV/Excel）" })
  async importSuppliers(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) {
      throw new BadRequestException("请上传导入文件");
    }
    if (!isSupportedTabularFile(file.originalname)) {
      throw new BadRequestException("仅支持 CSV/Excel 文件（.csv/.xlsx/.xls）");
    }
    return this.suppliersService.importFile(file.buffer, file.originalname);
  }

  @Get("options")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取供应商选项列表" })
  async getOptions() {
    return this.suppliersService.getOptions();
  }

  @Get(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "获取供应商详情" })
  async findOne(@Param("id") id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "创建供应商" })
  async create(@Body() createSupplierDto: CreateSupplierDto) {
    return this.suppliersService.create(createSupplierDto);
  }

  @Patch(":id")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "更新供应商" })
  async update(
    @Param("id") id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
  ) {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(":id")
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: "删除供应商" })
  async remove(@Param("id") id: string) {
    return this.suppliersService.remove(id);
  }
}
