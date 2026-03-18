import { Test } from '@nestjs/testing';
import { BudgetsController } from '../src/modules/budgets/budgets.controller';
import { BudgetsService } from '../src/modules/budgets/budgets.service';

describe('BudgetsController Flow (e2e-like)', () => {
  let controller: BudgetsController;

  const serviceMock = {
    findAll: jest.fn(),
    getDepartments: jest.fn(),
    getDepartmentSummary: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    toggleFreeze: jest.fn(),
    close: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BudgetsController],
      providers: [{ provide: BudgetsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(BudgetsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass query and simple getters', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });
    serviceMock.getDepartments.mockResolvedValueOnce(['市场部', '研发部']);
    serviceMock.findOne.mockResolvedValueOnce({ id: 'b1' });

    const list = await controller.findAll({ page: 1, pageSize: 20 } as any);
    const departments = await controller.getDepartments();
    const one = await controller.findOne('b1');

    expect(serviceMock.findAll).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
    expect(serviceMock.getDepartments).toHaveBeenCalledTimes(1);
    expect(serviceMock.findOne).toHaveBeenCalledWith('b1');
    expect(list.total).toBe(0);
    expect(departments).toHaveLength(2);
    expect(one.id).toBe('b1');
  });

  it('should parse year and pass to getDepartmentSummary', async () => {
    serviceMock.getDepartmentSummary.mockResolvedValueOnce({ year: 2026, department: '市场部' });

    const result = await controller.getDepartmentSummary('2026', '市场部');

    expect(serviceMock.getDepartmentSummary).toHaveBeenCalledWith(2026, '市场部');
    expect(result.year).toBe(2026);
  });

  it('should pass create/update/freeze/close/remove', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'b2' });
    serviceMock.update.mockResolvedValueOnce({ id: 'b2', budgetAmount: 20000 });
    serviceMock.toggleFreeze.mockResolvedValueOnce({ id: 'b2', status: 'FROZEN' });
    serviceMock.close.mockResolvedValueOnce({ id: 'b2', status: 'CLOSED' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'b2' });

    const createDto = { year: 2026, department: '市场部' } as any;
    const updateDto = { budgetAmount: 20000 } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update('b2', updateDto);
    const frozen = await controller.toggleFreeze('b2');
    const closed = await controller.close('b2');
    const removed = await controller.remove('b2');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith('b2', updateDto);
    expect(serviceMock.toggleFreeze).toHaveBeenCalledWith('b2');
    expect(serviceMock.close).toHaveBeenCalledWith('b2');
    expect(serviceMock.remove).toHaveBeenCalledWith('b2');
    expect(created.id).toBe('b2');
    expect(updated.budgetAmount).toBe(20000);
    expect(frozen.status).toBe('FROZEN');
    expect(closed.status).toBe('CLOSED');
    expect(removed.id).toBe('b2');
  });
});
