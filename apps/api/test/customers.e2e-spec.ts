import { Test } from '@nestjs/testing';
import { CustomersController } from '../src/modules/customers/customers.controller';
import { CustomersService } from '../src/modules/customers/customers.service';

describe('CustomersController Flow (e2e-like)', () => {
  let controller: CustomersController;

  const serviceMock = {
    findAll: jest.fn(),
    getOptions: jest.fn(),
    findPendingApproval: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    approve: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [{ provide: CustomersService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(CustomersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass query to findAll and pendingApproval', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });
    serviceMock.findPendingApproval.mockResolvedValueOnce({ items: [], total: 0 });

    const query = { page: 1, pageSize: 20, keyword: '客户' } as any;
    const allResult = await controller.findAll(query);
    const pendingResult = await controller.findPendingApproval(query);

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(serviceMock.findPendingApproval).toHaveBeenCalledWith(query);
    expect(allResult.total).toBe(0);
    expect(pendingResult.total).toBe(0);
  });

  it('should call getOptions and findOne', async () => {
    serviceMock.getOptions.mockResolvedValueOnce([{ id: 'c1', name: '客户A' }]);
    serviceMock.findOne.mockResolvedValueOnce({ id: 'c1' });

    const options = await controller.getOptions();
    const one = await controller.findOne('c1');

    expect(serviceMock.getOptions).toHaveBeenCalledTimes(1);
    expect(serviceMock.findOne).toHaveBeenCalledWith('c1');
    expect(options[0].id).toBe('c1');
    expect(one.id).toBe('c1');
  });

  it('should pass current user id to create and approve', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'c2' });
    serviceMock.approve.mockResolvedValueOnce({ id: 'c2', approvalStatus: 'APPROVED' });

    const createDto = { name: '客户B', type: 'ENTERPRISE' } as any;
    const approveDto = { approved: true, remark: '通过' } as any;
    const user = { id: 'u-manager' };

    const created = await controller.create(createDto, user);
    const approved = await controller.approve('c2', approveDto, user);

    expect(serviceMock.create).toHaveBeenCalledWith(createDto, 'u-manager');
    expect(serviceMock.approve).toHaveBeenCalledWith('c2', approveDto, 'u-manager');
    expect(created.id).toBe('c2');
    expect(approved.approvalStatus).toBe('APPROVED');
  });

  it('should call update and remove by id', async () => {
    serviceMock.update.mockResolvedValueOnce({ id: 'c3', name: '客户C-更新' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'c3', isDeleted: true });

    const updateDto = { name: '客户C-更新' } as any;
    const updated = await controller.update('c3', updateDto);
    const removed = await controller.remove('c3');

    expect(serviceMock.update).toHaveBeenCalledWith('c3', updateDto);
    expect(serviceMock.remove).toHaveBeenCalledWith('c3');
    expect(updated.name).toBe('客户C-更新');
    expect(removed.isDeleted).toBe(true);
  });
});
