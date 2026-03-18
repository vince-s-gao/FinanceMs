import { Test } from '@nestjs/testing';
import { UsersController } from '../src/modules/users/users.controller';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersController Flow (e2e-like)', () => {
  let controller: UsersController;

  const serviceMock = {
    findAll: jest.fn(),
    getOptions: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(UsersController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass paged query to findAll', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });

    const result = await controller.findAll(1 as any, 20 as any, 'FINANCE', true as any);

    expect(serviceMock.findAll).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      role: 'FINANCE',
      isActive: true,
    });
    expect(result.total).toBe(0);
  });

  it('should route options and findOne', async () => {
    serviceMock.getOptions.mockResolvedValueOnce([{ id: 'u1', name: '用户A' }]);
    serviceMock.findById.mockResolvedValueOnce({ id: 'u1' });

    const options = await controller.getOptions();
    const one = await controller.findOne('u1');

    expect(serviceMock.getOptions).toHaveBeenCalledTimes(1);
    expect(serviceMock.findById).toHaveBeenCalledWith('u1');
    expect(options[0].name).toBe('用户A');
    expect(one.id).toBe('u1');
  });

  it('should create/update/remove user', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'u2' });
    serviceMock.update.mockResolvedValueOnce({ id: 'u2', name: '用户B-更新' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'u2' });

    const createDto = { email: 'u2@example.com', name: '用户B' } as any;
    const updateDto = { name: '用户B-更新' } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update('u2', updateDto);
    const removed = await controller.remove('u2');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith('u2', updateDto);
    expect(serviceMock.remove).toHaveBeenCalledWith('u2');
    expect(created.id).toBe('u2');
    expect(updated.name).toBe('用户B-更新');
    expect(removed.id).toBe('u2');
  });
});
