import { Test } from "@nestjs/testing";
import { ExpensesController } from "../src/modules/expenses/expenses.controller";
import { ExpensesService } from "../src/modules/expenses/expenses.service";

describe("ExpensesController Flow (e2e-like)", () => {
  let controller: ExpensesController;

  const serviceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    approve: jest.fn(),
    pay: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [{ provide: ExpensesService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(ExpensesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should pass query and current user info to findAll", async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 1, pageSize: 20 } as any;
    const user = { id: "u-fin", role: "FINANCE" };
    const result = await controller.findAll(query, user);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query, "u-fin", "FINANCE");
    expect(result.total).toBe(0);
  });

  it("should use fallback department when creating expense", async () => {
    serviceMock.create.mockResolvedValueOnce({ id: "exp-1" });

    const dto = { reason: "出差报销", details: [] } as any;
    const user = { id: "u-emp", role: "EMPLOYEE" };
    await controller.create(dto, user as any);

    expect(serviceMock.create).toHaveBeenCalledWith(dto, "u-emp", "未分配");
  });

  it("should use user department when present", async () => {
    serviceMock.create.mockResolvedValueOnce({ id: "exp-2" });

    const dto = { reason: "业务招待", details: [] } as any;
    const user = { id: "u-emp2", role: "EMPLOYEE", department: "市场部" };
    await controller.create(dto, user as any);

    expect(serviceMock.create).toHaveBeenCalledWith(dto, "u-emp2", "市场部");
  });

  it("should pass current user context for update/submit/remove", async () => {
    serviceMock.update.mockResolvedValueOnce({ id: "exp-3" });
    serviceMock.submit.mockResolvedValueOnce({
      id: "exp-3",
      status: "PENDING",
    });
    serviceMock.remove.mockResolvedValueOnce({ id: "exp-3" });

    const user = { id: "u-1", role: "EMPLOYEE" };
    const updateDto = { reason: "更新后原因" } as any;

    await controller.update("exp-3", updateDto, user as any);
    await controller.submit("exp-3", user as any);
    await controller.remove("exp-3", user as any);

    expect(serviceMock.update).toHaveBeenCalledWith(
      "exp-3",
      updateDto,
      "u-1",
      "EMPLOYEE",
    );
    expect(serviceMock.submit).toHaveBeenCalledWith("exp-3", "u-1", "EMPLOYEE");
    expect(serviceMock.remove).toHaveBeenCalledWith("exp-3", "u-1", "EMPLOYEE");
  });

  it("should call approve and pay with expected params", async () => {
    serviceMock.approve.mockResolvedValueOnce({
      id: "exp-4",
      status: "APPROVED",
    });
    serviceMock.pay.mockResolvedValueOnce({ id: "exp-4", status: "PAID" });

    const approveDto = { approved: true } as any;
    const approveResult = await controller.approve("exp-4", approveDto);
    const payResult = await controller.pay("exp-4");

    expect(serviceMock.approve).toHaveBeenCalledWith("exp-4", approveDto);
    expect(serviceMock.pay).toHaveBeenCalledWith("exp-4");
    expect(approveResult.status).toBe("APPROVED");
    expect(payResult.status).toBe("PAID");
  });
});
