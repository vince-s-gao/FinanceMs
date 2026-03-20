// InfFinanceMs - 发票控制器

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';
import { FilesInterceptor } from '@nestjs/platform-express';

// 角色常量
const Role = {
  EMPLOYEE: 'EMPLOYEE',
  FINANCE: 'FINANCE',
  MANAGER: 'MANAGER',
  ADMIN: 'ADMIN',
} as const;

@ApiTags('发票管理')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  private isSupportedImportFile(fileName: string): boolean {
    const lower = fileName.toLowerCase();
    return (
      lower.endsWith('.pdf') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.doc') ||
      lower.endsWith('.docx') ||
      lower.endsWith('.csv') ||
      lower.endsWith('.xlsx') ||
      lower.endsWith('.xls')
    );
  }

  @Get()
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取发票列表' })
  async findAll(@Query() query: QueryInvoiceDto) {
    return this.invoicesService.findAll(query);
  }

  @Get('risk/:contractId')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取合同开票风险预警' })
  async getInvoiceRisk(@Param('contractId') contractId: string) {
    return this.invoicesService.getInvoiceRisk(contractId);
  }

  @Get(':id')
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: '获取发票详情' })
  async findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Post()
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '创建发票' })
  async create(@Body() createInvoiceDto: CreateInvoiceDto) {
    return this.invoicesService.create(createInvoiceDto);
  }

  @Post('import/preview')
  @Roles(Role.FINANCE, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: '默认关联合同ID（可选）' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOperation({ summary: '上传发票并预览解析结果（支持图片/PDF/Word/CSV/Excel）' })
  async previewImport(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('contractId') contractId?: string,
  ): Promise<any> {
    if (!files?.length) {
      throw new BadRequestException('请至少上传一个发票文件');
    }
    const invalid = files.find((file) => !this.isSupportedImportFile(file.originalname));
    if (invalid) {
      throw new BadRequestException(`不支持的文件类型：${invalid.originalname}`);
    }
    return this.invoicesService.previewImportFiles(files, contractId);
  }

  @Post('import')
  @Roles(Role.FINANCE, Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 50))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contractId: { type: 'string', description: '默认关联合同ID（可选）' },
        allowPartial: { type: 'string', example: 'false' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOperation({ summary: '确认导入解析后的发票数据' })
  async importParsedInvoices(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('contractId') contractId?: string,
    @Body('allowPartial') allowPartialRaw?: string,
  ): Promise<any> {
    if (!files?.length) {
      throw new BadRequestException('请至少上传一个发票文件');
    }
    const invalid = files.find((file) => !this.isSupportedImportFile(file.originalname));
    if (invalid) {
      throw new BadRequestException(`不支持的文件类型：${invalid.originalname}`);
    }
    const allowPartial =
      allowPartialRaw === 'true' || allowPartialRaw === '1' || allowPartialRaw === 'yes';
    return this.invoicesService.importFiles(files, { allowPartial, contractId });
  }

  @Patch(':id/void')
  @Roles(Role.FINANCE, Role.ADMIN)
  @ApiOperation({ summary: '作废发票' })
  async void(@Param('id') id: string) {
    return this.invoicesService.void(id);
  }
}
