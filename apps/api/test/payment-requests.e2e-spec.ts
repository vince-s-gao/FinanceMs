import { Test } from "@nestjs/testing";
import { PaymentRequestsController } from "../src/modules/payment-requests/payment-requests.controller";
import { PaymentRequestsService } from "../src/modules/payment-requests/payment-requests.service";

describe("PaymentRequestsController Flow (e2e-like)", () => {
  let controller: PaymentRequestsController;

  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    getStatistics: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    approve: jest.fn(),
    confirmPayment: jest.fn(),
    cancel: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentRequestsController],
      providers: [{ provide: PaymentRequestsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(PaymentRequestsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should create payment request with current user id", async () => {
    serviceMock.create.mockResolvedValueOnce({ id: "pr-1" });

    const dto = { reason: "付款事由" } as any;
    const user = { id: "user-1" };
    const result = await controller.create(dto, user);

    expect(serviceMock.create).toHaveBeenCalledWith(dto, "user-1");
    expect(result).toEqual({ id: "pr-1" });
  });

  it("should pass query to findAll", async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 2, pageSize: 10, status: "PENDING" } as any;
    const result = await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it("should approve with approver user id", async () => {
    serviceMock.approve.mockResolvedValueOnce({
      id: "pr-2",
      status: "APPROVED",
    });

    const dto = { status: "APPROVED", approvalRemark: "ok" } as any;
    const user = { id: "manager-1" };
    const result = await controller.approve("pr-2", dto, user);

    expect(serviceMock.approve).toHaveBeenCalledWith("pr-2", dto, "manager-1");
    expect(result.status).toBe("APPROVED");
  });

  it("should pass remark in confirmPayment", async () => {
    serviceMock.confirmPayment.mockResolvedValueOnce({
      id: "pr-3",
      status: "PAID",
    });

    const result = await controller.confirmPayment("pr-3", {
      remark: "已线下打款",
    } as any);

    expect(serviceMock.confirmPayment).toHaveBeenCalledWith(
      "pr-3",
      "已线下打款",
    );
    expect(result.status).toBe("PAID");
  });

  it("should call submit/cancel/remove by id", async () => {
    serviceMock.submit.mockResolvedValueOnce({ id: "pr-4", status: "PENDING" });
    serviceMock.cancel.mockResolvedValueOnce({
      id: "pr-4",
      status: "CANCELLED",
    });
    serviceMock.remove.mockResolvedValueOnce({ id: "pr-4", isDeleted: true });

    const submitResult = await controller.submit("pr-4");
    const cancelResult = await controller.cancel("pr-4");
    const removeResult = await controller.remove("pr-4");

    expect(serviceMock.submit).toHaveBeenCalledWith("pr-4");
    expect(serviceMock.cancel).toHaveBeenCalledWith("pr-4");
    expect(serviceMock.remove).toHaveBeenCalledWith("pr-4");
    expect(submitResult.status).toBe("PENDING");
    expect(cancelResult.status).toBe("CANCELLED");
    expect(removeResult.isDeleted).toBe(true);
  });
});
