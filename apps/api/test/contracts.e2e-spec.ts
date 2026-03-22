import { Test } from "@nestjs/testing";
import { ContractsController } from "../src/modules/contracts/contracts.controller";
import { ContractsService } from "../src/modules/contracts/contracts.service";

describe("ContractsController Flow (e2e-like)", () => {
  let controller: ContractsController;

  const serviceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    changeStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [{ provide: ContractsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(ContractsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should pass query to findAll", async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 1, pageSize: 20, status: "EXECUTING" } as any;
    const result = await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it("should fetch one contract by id", async () => {
    serviceMock.findOne.mockResolvedValueOnce({ id: "c-1" });

    const result = await controller.findOne("c-1");

    expect(serviceMock.findOne).toHaveBeenCalledWith("c-1");
    expect(result.id).toBe("c-1");
  });

  it("should create/update/change status/remove contract", async () => {
    serviceMock.create.mockResolvedValueOnce({ id: "c-2" });
    serviceMock.update.mockResolvedValueOnce({ id: "c-2", name: "更新后合同" });
    serviceMock.changeStatus.mockResolvedValueOnce({
      id: "c-2",
      status: "TERMINATED",
    });
    serviceMock.remove.mockResolvedValueOnce({ id: "c-2", isDeleted: true });

    const createDto = {
      contractNo: "HT-CUSTOM-001",
      name: "新合同",
      customerId: "cu-1",
    } as any;
    const updateDto = { name: "更新后合同" } as any;
    const statusDto = { status: "TERMINATED", reason: "终止原因" } as any;
    const adminUser = { id: "u-admin", role: "ADMIN" } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update("c-2", updateDto, adminUser);
    const changed = await controller.changeStatus("c-2", statusDto);
    const removed = await controller.remove("c-2", adminUser);

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith("c-2", updateDto, {
      allowNonDraft: true,
    });
    expect(serviceMock.changeStatus).toHaveBeenCalledWith("c-2", statusDto);
    expect(serviceMock.remove).toHaveBeenCalledWith("c-2", {
      allowNonDraft: true,
    });
    expect(created.id).toBe("c-2");
    expect(updated.name).toBe("更新后合同");
    expect(changed.status).toBe("TERMINATED");
    expect(removed.isDeleted).toBe(true);
  });
});
