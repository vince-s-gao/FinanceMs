// InfFinanceMs - 报表控制器

import { Controller, Get, Query, Res, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ReportsService } from "./reports.service";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import { Roles } from "../../common/decorators";
import { Response } from "express";

// 角色常量
const Role = {
  EMPLOYEE: "EMPLOYEE",
  FINANCE: "FINANCE",
  MANAGER: "MANAGER",
  ADMIN: "ADMIN",
} as const;

@ApiTags("报表看板")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private buildFileName(prefix: string) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${prefix}-${y}${m}${d}.csv`;
  }

  private sendCsv(res: Response, filename: string, csvContent: string) {
    const encodedFilename = encodeURIComponent(filename);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
    );
    // Excel 兼容：添加 UTF-8 BOM
    res.send(`\uFEFF${csvContent}`);
  }

  @Get("receivables")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "应收账款总览" })
  async getReceivablesOverview() {
    return this.reportsService.getReceivablesOverview();
  }

  @Get("customers")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "客户维度报表" })
  async getCustomerReport() {
    return this.reportsService.getCustomerReport();
  }

  @Get("expenses")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "报销分析" })
  async getExpenseAnalysis() {
    return this.reportsService.getExpenseAnalysis();
  }

  @Get("contracts/dashboard")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "合同执行看板" })
  async getContractDashboard() {
    return this.reportsService.getContractDashboard();
  }

  @Get("contracts")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "合同执行看板（兼容端点）" })
  async getContractDashboardCompat() {
    return this.reportsService.getContractDashboard();
  }

  @Get("contracts/profit")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "合同毛利分析" })
  async getContractProfitAnalysis(@Query("contractId") contractId?: string) {
    return this.reportsService.getContractProfitAnalysis(contractId);
  }

  @Get("export/receivables")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "导出应收账款总览（CSV）" })
  async exportReceivablesCsv(@Res() res: Response) {
    const csv = await this.reportsService.exportReceivablesOverviewCsv();
    this.sendCsv(res, this.buildFileName("receivables-overview"), csv);
  }

  @Get("export/customers")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "导出客户维度报表（CSV）" })
  async exportCustomerCsv(@Res() res: Response) {
    const csv = await this.reportsService.exportCustomerReportCsv();
    this.sendCsv(res, this.buildFileName("customer-report"), csv);
  }

  @Get("export/contracts/profit")
  @Roles(Role.FINANCE, Role.MANAGER, Role.ADMIN)
  @ApiOperation({ summary: "导出合同毛利分析（CSV）" })
  async exportContractProfitCsv(
    @Res() res: Response,
    @Query("contractId") contractId?: string,
  ) {
    const csv = await this.reportsService.exportContractProfitCsv(contractId);
    this.sendCsv(res, this.buildFileName("contract-profit"), csv);
  }
}
