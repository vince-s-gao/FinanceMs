// InfFinanceMs - 合同控制器

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
  Body as ReqBody,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { QueryContractDto } from './dto/query-contract.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('合同管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  private getScopedOperatorId(currentUser: any): string | undefined {
    if (!currentUser) return undefined;
    return currentUser.role === Role.ADMIN ? undefined : currentUser.id;
  }

  private buildFileName(prefix: string) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${prefix}-${y}${m}${d}.csv`;
  }

  private buildExcelFileName(prefix: string) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${prefix}-${y}${m}${d}.xlsx`;
  }

  private sendCsv(res: Response, filename: string, csvContent: string) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(`\uFEFF${csvContent}`);
  }

  private sendExcel(res: Response, filename: string, buffer: Buffer) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );
    res.send(buffer);
  }

  private isSupportedImportFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls');
  }

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同列表' })
  async findAll(@Query() query: QueryContractDto) {
    return this.contractsService.findAll(query);
  }

  @Get('export/csv')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '导出合同列表（CSV）' })
  async exportCsv(@Query() query: QueryContractDto, @Res() res: Response) {
    const csv = await this.contractsService.exportCsv(query);
    this.sendCsv(res, this.buildFileName('contracts'), csv);
  }

  @Get('export/excel')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '导出合同列表（Excel）' })
  async exportExcel(@Query() query: QueryContractDto, @Res() res: Response) {
    const buffer = await this.contractsService.exportExcel(query);
    this.sendExcel(res, this.buildExcelFileName('contracts'), buffer);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建合同' })
  async create(@Body() createContractDto: CreateContractDto) {
    return this.contractsService.create(createContractDto);
  }

  @Post('import/csv')
  @Roles(Role.FINANCE, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        allowPartial: { type: 'string', example: 'true', description: '是否忽略错误并仅导入有效行' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: '批量导入合同（CSV/Excel）' })
  async importCsv(
    @UploadedFile() file?: Express.Multer.File,
    @ReqBody('allowPartial') allowPartialRaw?: string,
    @CurrentUser() currentUser?: any,
  ) {
    if (!file) {
      throw new BadRequestException('请上传导入文件');
    }
    if (!this.isSupportedImportFile(file.originalname)) {
      throw new BadRequestException('仅支持 CSV/Excel 文件（.csv/.xlsx/.xls）');
    }
    const allowPartial =
      allowPartialRaw === 'true' || allowPartialRaw === '1' || allowPartialRaw === 'yes';
    return this.contractsService.importCsv(file.buffer, {
      allowPartial,
      fileName: file.originalname,
      operatorId: currentUser?.id,
    });
  }

  @Post('import/csv/preview')
  @Roles(Role.FINANCE, Role.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: '预校验批量导入合同（CSV/Excel）' })
  async previewImportCsv(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('请上传导入文件');
    }
    if (!this.isSupportedImportFile(file.originalname)) {
      throw new BadRequestException('仅支持 CSV/Excel 文件（.csv/.xlsx/.xls）');
    }
    return this.contractsService.previewImportCsv(file.buffer, file.originalname);
  }

  @Get('import/template/excel')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '下载合同导入模板（Excel）' })
  async downloadImportTemplateExcel(@Res() res: Response) {
    const buffer = this.contractsService.getImportTemplateExcel();
    this.sendExcel(res, 'contracts-import-template.xlsx', buffer);
  }

  @Get('import/history')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '获取合同导入历史（最近记录）' })
  async getImportHistory(
    @Query('limit') limitRaw?: string,
    @CurrentUser() currentUser?: any,
  ) {
    const parsedLimit = Number(limitRaw || 10);
    const limit = Number.isNaN(parsedLimit) ? 10 : parsedLimit;
    return this.contractsService.getImportHistory(limit, this.getScopedOperatorId(currentUser));
  }

  @Get('import/history/:id/errors/csv')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '下载导入错误报告（CSV）' })
  async downloadImportErrorsCsv(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() currentUser?: any,
  ) {
    const payload = await this.contractsService.exportImportErrorCsv(
      id,
      this.getScopedOperatorId(currentUser),
    );
    this.sendCsv(res, payload.fileName, payload.csv);
  }

  @Get('import/history/:id/errors/excel')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '下载导入错误报告（Excel）' })
  async downloadImportErrorsExcel(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() currentUser?: any,
  ) {
    const payload = await this.contractsService.exportImportErrorExcel(
      id,
      this.getScopedOperatorId(currentUser),
    );
    this.sendExcel(res, payload.fileName, payload.buffer);
  }

  @Delete('import/history')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '清空合同导入历史' })
  async clearImportHistory(@CurrentUser() currentUser?: any) {
    return this.contractsService.clearImportHistory(this.getScopedOperatorId(currentUser));
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同详情' })
  async findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '更新合同' })
  async update(@Param('id') id: string, @Body() updateContractDto: UpdateContractDto) {
    return this.contractsService.update(id, updateContractDto);
  }

  @Patch(':id/status')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '变更合同状态' })
  async changeStatus(@Param('id') id: string, @Body() changeStatusDto: ChangeStatusDto) {
    return this.contractsService.changeStatus(id, changeStatusDto);
  }

  @Delete(':id')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '删除合同' })
  async remove(@Param('id') id: string) {
    return this.contractsService.remove(id);
  }
}
