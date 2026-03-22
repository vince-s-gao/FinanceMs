import { Test } from "@nestjs/testing";
import { ReportsController } from "../src/modules/reports/reports.controller";
import { ReportsService } from "../src/modules/reports/reports.service";

describe("ReportsController Flow (e2e-like)", () => {
  let controller: ReportsController;

  const serviceMock = {
    getReceivablesOverview: jest.fn(),
    getCustomerReport: jest.fn(),
    getExpenseAnalysis: jest.fn(),
    getContractDashboard: jest.fn(),
    getContractProfitAnalysis: jest.fn(),
    exportReceivablesOverviewCsv: jest.fn(),
    exportCustomerReportCsv: jest.fn(),
    exportContractProfitCsv: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should route overview report endpoints", async () => {
    serviceMock.getReceivablesOverview.mockResolvedValueOnce({
      totalReceivable: 1000,
    });
    serviceMock.getCustomerReport.mockResolvedValueOnce([
      { customerId: "c1", customerName: "客户A" },
    ]);
    serviceMock.getExpenseAnalysis.mockResolvedValueOnce({ monthlyTotal: 500 });
    serviceMock.getContractDashboard.mockResolvedValue({ executingCount: 10 });

    const receivables = await controller.getReceivablesOverview();
    const customers = await controller.getCustomerReport();
    const expenses = await controller.getExpenseAnalysis();
    const dashboard = await controller.getContractDashboard();
    const compatDashboard = await controller.getContractDashboardCompat();

    expect(serviceMock.getReceivablesOverview).toHaveBeenCalledTimes(1);
    expect(serviceMock.getCustomerReport).toHaveBeenCalledTimes(1);
    expect(serviceMock.getExpenseAnalysis).toHaveBeenCalledTimes(1);
    expect(serviceMock.getContractDashboard).toHaveBeenCalledTimes(2);
    expect(receivables.totalReceivable).toBe(1000);
    expect(customers[0].customerName).toBe("客户A");
    expect(expenses.monthlyTotal).toBe(500);
    expect(dashboard.executingCount).toBe(10);
    expect(compatDashboard.executingCount).toBe(10);
  });

  it("should pass contractId to profit analysis", async () => {
    serviceMock.getContractProfitAnalysis.mockResolvedValueOnce([
      { contractId: "ct-1" },
    ]);

    const result = await controller.getContractProfitAnalysis("ct-1");

    expect(serviceMock.getContractProfitAnalysis).toHaveBeenCalledWith("ct-1");
    expect(result[0].contractId).toBe("ct-1");
  });

  it("should export csv responses with attachment headers", async () => {
    serviceMock.exportReceivablesOverviewCsv.mockResolvedValueOnce("h1,h2");
    serviceMock.exportCustomerReportCsv.mockResolvedValueOnce("h1,h2");
    serviceMock.exportContractProfitCsv.mockResolvedValueOnce("h1,h2");

    const buildRes = () =>
      ({
        setHeader: jest.fn(),
        send: jest.fn(),
      }) as any;

    const receivablesRes = buildRes();
    const customersRes = buildRes();
    const profitRes = buildRes();

    await controller.exportReceivablesCsv(receivablesRes);
    await controller.exportCustomerCsv(customersRes);
    await controller.exportContractProfitCsv(profitRes, "ct-2");

    expect(serviceMock.exportReceivablesOverviewCsv).toHaveBeenCalledTimes(1);
    expect(serviceMock.exportCustomerReportCsv).toHaveBeenCalledTimes(1);
    expect(serviceMock.exportContractProfitCsv).toHaveBeenCalledWith("ct-2");

    expect(receivablesRes.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/csv; charset=utf-8",
    );
    expect(receivablesRes.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringMatching(
        /^attachment; filename="receivables-overview-\d{8}\.csv"; filename\*=UTF-8''receivables-overview-\d{8}\.csv$/,
      ),
    );
    expect(receivablesRes.send).toHaveBeenCalledWith(
      expect.stringContaining("h1,h2"),
    );
    expect(customersRes.send).toHaveBeenCalledWith(
      expect.stringContaining("h1,h2"),
    );
    expect(profitRes.send).toHaveBeenCalledWith(
      expect.stringContaining("h1,h2"),
    );
  });
});
