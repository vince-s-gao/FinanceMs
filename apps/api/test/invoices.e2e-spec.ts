import { Test } from "@nestjs/testing";
import { InvoicesController } from "../src/modules/invoices/invoices.controller";
import { InvoicesService } from "../src/modules/invoices/invoices.service";

describe("InvoicesController Flow (e2e-like)", () => {
  let controller: InvoicesController;

  const serviceMock = {
    findAll: jest.fn(),
    getInvoiceRisk: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    void: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvoicesController],
      providers: [{ provide: InvoicesService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(InvoicesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should pass query to findAll", async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 1, pageSize: 20, status: "ISSUED" } as any;
    const result = await controller.findAll(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(result.total).toBe(0);
  });

  it("should fetch invoice risk by contract id", async () => {
    serviceMock.getInvoiceRisk.mockResolvedValueOnce({
      contractId: "ct-1",
      hasRisk: true,
      uninvoicedAmount: 500,
    });

    const result = await controller.getInvoiceRisk("ct-1");

    expect(serviceMock.getInvoiceRisk).toHaveBeenCalledWith("ct-1");
    expect(result.hasRisk).toBe(true);
  });

  it("should find one/create/void invoice", async () => {
    serviceMock.findOne.mockResolvedValueOnce({ id: "inv-1" });
    serviceMock.create.mockResolvedValueOnce({
      id: "inv-2",
      invoiceNo: "INV-002",
    });
    serviceMock.void.mockResolvedValueOnce({ id: "inv-2", status: "VOIDED" });

    const createDto = {
      contractId: "ct-1",
      invoiceNo: "INV-002",
      invoiceType: "VAT_SPECIAL",
      amount: 1000,
      invoiceDate: "2026-03-17",
    } as any;

    const found = await controller.findOne("inv-1");
    const created = await controller.create(createDto);
    const voided = await controller.void("inv-2");

    expect(serviceMock.findOne).toHaveBeenCalledWith("inv-1");
    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.void).toHaveBeenCalledWith("inv-2");
    expect(found.id).toBe("inv-1");
    expect(created.invoiceNo).toBe("INV-002");
    expect(voided.status).toBe("VOIDED");
  });
});
