import { Decimal } from "@prisma/client/runtime/library";
import { ReportsService } from "./reports.service";

describe("ReportsService", () => {
  let service: ReportsService;
  let prisma: any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-17T08:00:00.000Z"));

    prisma = {
      contract: {
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      expense: {
        aggregate: jest.fn(),
      },
      expenseDetail: {
        aggregate: jest.fn(),
      },
      paymentRecord: {
        aggregate: jest.fn(),
      },
      paymentPlan: {
        findMany: jest.fn(),
      },
    };

    service = new ReportsService(prisma);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should calculate receivable overview and aging distribution", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        amountWithTax: new Decimal(1000),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2025-12-01T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(200) }],
      },
    ]);

    const result = await service.getReceivablesOverview();

    expect(result.totalContractAmount).toBe(1000);
    expect(result.totalReceived).toBe(200);
    expect(result.totalReceivable).toBe(800);
    expect(result.agingDistribution.daysOver90).toBe(800);
  });

  it("should classify receivables into normal and 0-30 buckets", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c-normal",
        amountWithTax: new Decimal(1000),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2026-03-20T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(100) }],
      },
      {
        id: "c-30",
        amountWithTax: new Decimal(1000),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2026-03-01T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(500) }],
      },
    ]);

    const result = await service.getReceivablesOverview();

    expect(result.agingDistribution.normal).toBe(900);
    expect(result.agingDistribution.days0to30).toBe(500);
  });

  it("should classify receivables into 31-90 bucket and skip non-positive receivable", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c-31-90",
        amountWithTax: new Decimal(1000),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2026-01-15T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(200) }],
      },
      {
        id: "c-zero",
        amountWithTax: new Decimal(100),
        paymentPlans: [],
        paymentRecords: [{ amount: new Decimal(100) }],
      },
    ]);

    const result = await service.getReceivablesOverview();

    expect(result.agingDistribution.days31to90).toBe(800);
    expect(result.agingDistribution.normal).toBe(0);
  });

  it("should use earliest overdue plan and hit normal bucket for same-day due date", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c-sort-normal",
        amountWithTax: new Decimal(300),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2026-03-17T00:00:00.000Z"),
          },
          {
            status: "PENDING",
            planDate: new Date("2026-03-16T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(100) }],
      },
    ]);

    const result = await service.getReceivablesOverview();

    expect(result.totalReceivable).toBe(200);
    expect(result.agingDistribution.days0to30).toBe(200);
  });

  it("should put receivable into normal bucket when earliest overdue plan is today", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c-normal-switch",
        amountWithTax: new Decimal(500),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: new Date("2026-03-17T00:00:00.000Z"),
          },
        ],
        paymentRecords: [{ amount: new Decimal(100) }],
      },
    ]);

    const result = await service.getReceivablesOverview();
    expect(result.agingDistribution.normal).toBe(400);
  });

  it("should support string planDate inputs when calculating aging", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c-str-date",
        amountWithTax: new Decimal(500),
        paymentPlans: [
          {
            status: "PENDING",
            planDate: "2026-03-10T00:00:00.000Z",
          },
        ],
        paymentRecords: [{ amount: new Decimal(100) }],
      },
    ]);

    const result = await service.getReceivablesOverview();
    expect(result.totalReceivable).toBe(400);
    expect(result.agingDistribution.days0to30).toBe(400);
  });

  it("should aggregate expense analysis fields and calculate no-invoice ratio", async () => {
    prisma.expense.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: new Decimal(1000) },
        _count: 2,
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: new Decimal(200) },
        _count: 1,
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: new Decimal(300) },
        _count: 1,
      });
    prisma.expenseDetail.aggregate
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(100) } })
      .mockResolvedValueOnce({ _sum: { amount: new Decimal(25) } });

    const result = await service.getExpenseAnalysis();

    expect(result.monthlyTotal).toBe(1000);
    expect(result.pendingAmount).toBe(200);
    expect(result.unpaidAmount).toBe(300);
    expect(result.noInvoiceRatio).toBe(25);
  });

  it("should fallback expense analysis sums and ratio to zero when aggregates are empty", async () => {
    prisma.expense.aggregate
      .mockResolvedValueOnce({
        _sum: { totalAmount: null },
        _count: 0,
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: null },
        _count: 0,
      })
      .mockResolvedValueOnce({
        _sum: { totalAmount: null },
        _count: 0,
      });
    prisma.expenseDetail.aggregate
      .mockResolvedValueOnce({ _sum: { amount: null } })
      .mockResolvedValueOnce({ _sum: { amount: null } });

    const result = await service.getExpenseAnalysis();
    expect(result.monthlyTotal).toBe(0);
    expect(result.pendingAmount).toBe(0);
    expect(result.unpaidAmount).toBe(0);
    expect(result.noInvoiceRatio).toBe(0);
  });

  it("should calculate contract dashboard fields", async () => {
    prisma.contract.count.mockResolvedValueOnce(3);
    prisma.contract.aggregate.mockResolvedValueOnce({
      _sum: { amountWithTax: new Decimal(900) },
      _count: 2,
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: new Decimal(600) },
    });
    prisma.paymentPlan.findMany.mockResolvedValueOnce([
      {
        id: "p1",
        period: 1,
        planAmount: new Decimal(300),
        planDate: new Date("2026-03-18T08:00:00.000Z"),
        contract: {
          id: "c1",
          contractNo: "HT-001",
          name: "测试合同",
        },
      },
    ]);

    const result = await service.getContractDashboard();

    expect(result.executingCount).toBe(3);
    expect(result.monthlyNewCount).toBe(2);
    expect(result.monthlyNewAmount).toBe(900);
    expect(result.monthlyPaymentAmount).toBe(600);
    expect(result.upcomingPayments).toHaveLength(1);
    expect(result.upcomingPayments[0].daysUntilDue).toBe(1);
  });

  it("should fallback dashboard amounts to zero when aggregate sum is null", async () => {
    prisma.contract.count.mockResolvedValueOnce(0);
    prisma.contract.aggregate.mockResolvedValueOnce({
      _sum: { amountWithTax: null },
      _count: 0,
    });
    prisma.paymentRecord.aggregate.mockResolvedValueOnce({
      _sum: { amount: null },
    });
    prisma.paymentPlan.findMany.mockResolvedValueOnce([]);

    const result = await service.getContractDashboard();
    expect(result.monthlyNewAmount).toBe(0);
    expect(result.monthlyPaymentAmount).toBe(0);
    expect(result.upcomingPayments).toEqual([]);
  });

  it("should build customer report with overdue over 90 days", async () => {
    prisma.customer = {
      findMany: jest.fn().mockResolvedValueOnce([
        {
          id: "cus-1",
          name: "客户A",
          contracts: [
            {
              amountWithTax: new Decimal(1000),
              paymentRecords: [{ amount: new Decimal(200) }],
              paymentPlans: [
                {
                  status: "PENDING",
                  planDate: new Date("2025-11-01T00:00:00.000Z"),
                },
              ],
            },
          ],
        },
      ]),
    };

    const result = await service.getCustomerReport();

    expect(result).toHaveLength(1);
    expect(result[0].customerName).toBe("客户A");
    expect(result[0].receivableAmount).toBe(800);
    expect(result[0].overdueOver90).toBe(800);
  });

  it("should sort overdue plans in customer report and use earliest overdue date", async () => {
    prisma.customer = {
      findMany: jest.fn().mockResolvedValueOnce([
        {
          id: "cus-3",
          name: "客户C",
          contracts: [
            {
              amountWithTax: new Decimal(800),
              paymentRecords: [{ amount: new Decimal(200) }],
              paymentPlans: [
                {
                  status: "PENDING",
                  planDate: new Date("2026-02-20T00:00:00.000Z"),
                },
                {
                  status: "PENDING",
                  planDate: new Date("2025-11-01T00:00:00.000Z"),
                },
              ],
            },
          ],
        },
      ]),
    };

    const result = await service.getCustomerReport();
    expect(result[0].overdueOver90).toBe(600);
  });

  it("should return no overdue in customer report when receivable is zero", async () => {
    prisma.customer = {
      findMany: jest.fn().mockResolvedValueOnce([
        {
          id: "cus-2",
          name: "客户B",
          contracts: [
            {
              amountWithTax: new Decimal(500),
              paymentRecords: [{ amount: new Decimal(500) }],
              paymentPlans: [],
            },
          ],
        },
      ]),
    };

    const result = await service.getCustomerReport();
    expect(result[0].overdueOver90).toBe(0);
  });

  it("should calculate contract profit analysis and loss marker", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        contractNo: "HT-002",
        name: "低毛利合同",
        customer: { id: "cus1", name: "客户A" },
        amountWithTax: new Decimal(2000),
        paymentRecords: [{ amount: new Decimal(1000) }],
        costs: [{ amount: new Decimal(1200) }],
      },
    ]);

    const result = await service.getContractProfitAnalysis("c1");

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "c1" }),
      }),
    );
    expect(result[0].contractId).toBe("c1");
    expect(result[0].totalReceived).toBe(1000);
    expect(result[0].totalCost).toBe(1200);
    expect(result[0].profit).toBe(-200);
    expect(result[0].isLoss).toBe(true);
  });

  it("should handle zero received amount in contract profit analysis", async () => {
    prisma.contract.findMany.mockResolvedValueOnce([
      {
        id: "c2",
        contractNo: "HT-003",
        name: "未回款合同",
        customer: { id: "cus2", name: "客户B" },
        amountWithTax: new Decimal(1000),
        paymentRecords: [],
        costs: [{ amount: new Decimal(100) }],
      },
    ]);

    const result = await service.getContractProfitAnalysis();
    expect(result[0].profitRate).toBe(0);
    expect(result[0].isLoss).toBe(true);
  });

  it("should export receivables overview as csv", async () => {
    jest.spyOn(service, "getReceivablesOverview").mockResolvedValueOnce({
      totalContractAmount: 1000,
      totalReceived: 200,
      totalReceivable: 800,
      agingDistribution: {
        normal: 100,
        days0to30: 200,
        days31to90: 300,
        daysOver90: 200,
      },
    });

    const csv = await service.exportReceivablesOverviewCsv();

    expect(csv).toContain('"指标","金额"');
    expect(csv).toContain('"合同总额","1000"');
    expect(csv).toContain('"账龄-90天以上","200"');
  });

  it("should export customer report csv", async () => {
    jest.spyOn(service, "getCustomerReport").mockResolvedValueOnce([
      {
        customerId: "cus-1",
        customerName: "客户A",
        contractCount: 2,
        totalAmount: 1000,
        receivedAmount: 800,
        receivableAmount: 200,
        overdueOver90: 50,
      },
    ] as any);

    const csv = await service.exportCustomerReportCsv();

    expect(csv).toContain(
      '"客户名称","合同数","合同总额","已收款","应收款","90天以上逾期"',
    );
    expect(csv).toContain('"客户A","2","1000","800","200","50"');
  });

  it("should render empty csv cell when customer field is null", async () => {
    jest.spyOn(service, "getCustomerReport").mockResolvedValueOnce([
      {
        customerId: "cus-2",
        customerName: null,
        contractCount: 1,
        totalAmount: 10,
        receivedAmount: 5,
        receivableAmount: 5,
        overdueOver90: 0,
      },
    ] as any);

    const csv = await service.exportCustomerReportCsv();
    expect(csv).toContain(',"1","10","5","5","0"');
  });

  it("should export contract profit csv with loss marker", async () => {
    const profitSpy = jest
      .spyOn(service, "getContractProfitAnalysis")
      .mockResolvedValueOnce([
        {
          contractId: "c1",
          contractNo: "HT-001",
          contractName: "合同A",
          customerName: "客户A",
          contractAmount: 1000,
          totalReceived: 900,
          totalCost: 1000,
          profit: -100,
          profitRate: -11.11,
          isLoss: true,
        },
      ] as any);

    const csv = await service.exportContractProfitCsv("c1");

    expect(profitSpy).toHaveBeenCalledWith("c1");
    expect(csv).toContain(
      '"合同编号","合同名称","客户","合同金额","已回款","总成本","毛利","毛利率(%)","是否亏损"',
    );
    expect(csv).toContain(
      '"HT-001","合同A","客户A","1000","900","1000","-100","-11.11","是"',
    );
  });

  it("should export contract profit csv with non-loss marker", async () => {
    jest.spyOn(service, "getContractProfitAnalysis").mockResolvedValueOnce([
      {
        contractId: "c2",
        contractNo: "HT-002",
        contractName: "合同B",
        customerName: "客户B",
        contractAmount: 2000,
        totalReceived: 1800,
        totalCost: 1000,
        profit: 800,
        profitRate: 44.44,
        isLoss: false,
      },
    ] as any);

    const csv = await service.exportContractProfitCsv();
    expect(csv).toContain(
      '"HT-002","合同B","客户B","2000","1800","1000","800","44.44","否"',
    );
  });
});
