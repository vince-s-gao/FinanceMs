import { Test } from '@nestjs/testing';
import { CostsController } from '../src/modules/costs/costs.controller';
import { CostsService } from '../src/modules/costs/costs.service';

describe('CostsController Flow (e2e-like)', () => {
  let controller: CostsController;

  const serviceMock = {
    findAll: jest.fn(),
    getContractCostSummary: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CostsController],
      providers: [{ provide: CostsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(CostsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should route list/summary/detail', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });
    serviceMock.getContractCostSummary.mockResolvedValueOnce({ total: 3000 });
    serviceMock.findOne.mockResolvedValueOnce({ id: 'co1' });

    const list = await controller.findAll({ page: 1, pageSize: 20 } as any);
    const summary = await controller.getContractCostSummary('c1');
    const detail = await controller.findOne('co1');

    expect(serviceMock.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(serviceMock.getContractCostSummary).toHaveBeenCalledWith('c1');
    expect(serviceMock.findOne).toHaveBeenCalledWith('co1');
    expect(list.total).toBe(0);
    expect(summary.total).toBe(3000);
    expect(detail.id).toBe('co1');
  });

  it('should create and remove cost', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'co2' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'co2' });

    const createDto = { projectId: 'p1', amount: 1000, feeType: 'TRAVEL' } as any;

    const created = await controller.create(createDto);
    const removed = await controller.remove('co2');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.remove).toHaveBeenCalledWith('co2');
    expect(created.id).toBe('co2');
    expect(removed.id).toBe('co2');
  });
});
