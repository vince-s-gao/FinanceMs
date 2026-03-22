import { Test } from "@nestjs/testing";
import { PaymentsController } from "../src/modules/payments/payments.controller";
import { PaymentsService } from "../src/modules/payments/payments.service";

describe("PaymentsController Flow (e2e-like)", () => {
  let controller: PaymentsController;

  const serviceMock = {
    getStatistics: jest.fn(),
    findPlansByContract: jest.fn(),
    findRecordsByContract: jest.fn(),
    createPlan: jest.fn(),
    createPlans: jest.fn(),
    createRecord: jest.fn(),
    removePlan: jest.fn(),
    removeRecord: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(PaymentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should route statistics and contract-level queries", async () => {
    serviceMock.getStatistics.mockResolvedValueOnce({
      summary: { contractCount: 1 },
    });
    serviceMock.findPlansByContract.mockResolvedValueOnce([{ id: "pp1" }]);
    serviceMock.findRecordsByContract.mockResolvedValueOnce([{ id: "pr1" }]);

    const stats = await controller.getStatistics();
    const plans = await controller.findPlansByContract("c1");
    const records = await controller.findRecordsByContract("c1");

    expect(serviceMock.getStatistics).toHaveBeenCalledTimes(1);
    expect(serviceMock.findPlansByContract).toHaveBeenCalledWith("c1");
    expect(serviceMock.findRecordsByContract).toHaveBeenCalledWith("c1");
    expect(stats.summary.contractCount).toBe(1);
    expect(plans[0].id).toBe("pp1");
    expect(records[0].id).toBe("pr1");
  });

  it("should create plan(s) and record", async () => {
    serviceMock.createPlan.mockResolvedValueOnce({ id: "pp2" });
    serviceMock.createPlans.mockResolvedValueOnce({ count: 2 });
    serviceMock.createRecord.mockResolvedValueOnce({ id: "pr2" });

    const planDto = { contractId: "c2", period: 1, planAmount: 100 } as any;
    const planList = [
      { period: 1, planAmount: 100 },
      { period: 2, planAmount: 200 },
    ] as any;
    const recordDto = { contractId: "c2", amount: 50 } as any;

    const createdPlan = await controller.createPlan(planDto);
    const createdPlans = await controller.createPlans("c2", planList);
    const createdRecord = await controller.createRecord(recordDto);

    expect(serviceMock.createPlan).toHaveBeenCalledWith(planDto);
    expect(serviceMock.createPlans).toHaveBeenCalledWith("c2", planList);
    expect(serviceMock.createRecord).toHaveBeenCalledWith(recordDto);
    expect(createdPlan.id).toBe("pp2");
    expect(createdPlans.count).toBe(2);
    expect(createdRecord.id).toBe("pr2");
  });

  it("should remove plan and record by id", async () => {
    serviceMock.removePlan.mockResolvedValueOnce({ id: "pp3" });
    serviceMock.removeRecord.mockResolvedValueOnce({
      message: "回款记录删除成功",
    });

    const removedPlan = await controller.removePlan("pp3");
    const removedRecord = await controller.removeRecord("pr3");

    expect(serviceMock.removePlan).toHaveBeenCalledWith("pp3");
    expect(serviceMock.removeRecord).toHaveBeenCalledWith("pr3");
    expect(removedPlan.id).toBe("pp3");
    expect(removedRecord.message).toContain("删除成功");
  });
});
