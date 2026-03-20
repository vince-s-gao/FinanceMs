import { Test } from '@nestjs/testing';
import { DictionariesController } from '../src/modules/dictionaries/dictionaries.controller';
import { DictionariesService } from '../src/modules/dictionaries/dictionaries.service';

describe('DictionariesController Flow (e2e-like)', () => {
  let controller: DictionariesController;

  const serviceMock = {
    findAll: jest.fn(),
    getTypes: jest.fn(),
    findByType: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    initCustomerTypes: jest.fn(),
    initExpenseTypes: jest.fn(),
    initContractTypes: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DictionariesController],
      providers: [{ provide: DictionariesService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(DictionariesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should route list/type/detail requests', async () => {
    serviceMock.findAll.mockResolvedValueOnce([]);
    serviceMock.getTypes.mockResolvedValueOnce(['CUSTOMER_TYPE']);
    serviceMock.findByType.mockResolvedValueOnce([{ code: 'ENTERPRISE' }]);
    serviceMock.findOne.mockResolvedValueOnce({ id: 'd1' });

    await controller.findAll({ type: 'CUSTOMER_TYPE' } as any);
    const types = await controller.getTypes();
    const byType = await controller.findByType('CUSTOMER_TYPE');
    const one = await controller.findOne('d1');

    expect(serviceMock.findAll).toHaveBeenCalledWith({ type: 'CUSTOMER_TYPE' });
    expect(serviceMock.getTypes).toHaveBeenCalledTimes(1);
    expect(serviceMock.findByType).toHaveBeenCalledWith('CUSTOMER_TYPE');
    expect(serviceMock.findOne).toHaveBeenCalledWith('d1');
    expect(types[0]).toBe('CUSTOMER_TYPE');
    expect(byType[0].code).toBe('ENTERPRISE');
    expect(one.id).toBe('d1');
  });

  it('should route create/init/update/remove operations', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'd2' });
    serviceMock.initCustomerTypes.mockResolvedValueOnce([{ code: 'ENTERPRISE' }]);
    serviceMock.initExpenseTypes.mockResolvedValueOnce([{ code: 'TRAVEL' }]);
    serviceMock.initContractTypes.mockResolvedValueOnce([{ code: 'SERVICE' }]);
    serviceMock.update.mockResolvedValueOnce({ id: 'd2', name: '企业客户' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'd2' });

    const createDto = { type: 'CUSTOMER_TYPE', code: 'ENTERPRISE', name: '企业' } as any;
    const updateDto = { name: '企业客户' } as any;

    const created = await controller.create(createDto);
    const initCustomer = await controller.initCustomerTypes();
    const initExpense = await controller.initExpenseTypes();
    const initContract = await controller.initContractTypes();
    const updated = await controller.update('d2', updateDto);
    const removed = await controller.remove('d2');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.initCustomerTypes).toHaveBeenCalledTimes(1);
    expect(serviceMock.initExpenseTypes).toHaveBeenCalledTimes(1);
    expect(serviceMock.initContractTypes).toHaveBeenCalledTimes(1);
    expect(serviceMock.update).toHaveBeenCalledWith('d2', updateDto);
    expect(serviceMock.remove).toHaveBeenCalledWith('d2');
    expect(created.id).toBe('d2');
    expect(initCustomer[0].code).toBe('ENTERPRISE');
    expect(initExpense[0].code).toBe('TRAVEL');
    expect(initContract[0].code).toBe('SERVICE');
    expect(updated.name).toBe('企业客户');
    expect(removed.id).toBe('d2');
  });
});
