import { Test } from '@nestjs/testing';
import { BankAccountsController } from '../src/modules/bank-accounts/bank-accounts.controller';
import { BankAccountsService } from '../src/modules/bank-accounts/bank-accounts.service';

describe('BankAccountsController Flow (e2e-like)', () => {
  let controller: BankAccountsController;

  const serviceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    toggleEnabled: jest.fn(),
    setDefault: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BankAccountsController],
      providers: [{ provide: BankAccountsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(BankAccountsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should pass create/update/findOne/remove calls', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'ba-1' });
    serviceMock.update.mockResolvedValueOnce({ id: 'ba-1', accountName: '更新户名' });
    serviceMock.findOne.mockResolvedValueOnce({ id: 'ba-1' });
    serviceMock.remove.mockResolvedValueOnce({ id: 'ba-1' });

    const createDto = { accountName: '户名A' } as any;
    const updateDto = { accountName: '更新户名' } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update('ba-1', updateDto);
    const found = await controller.findOne('ba-1');
    const removed = await controller.remove('ba-1');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith('ba-1', updateDto);
    expect(serviceMock.findOne).toHaveBeenCalledWith('ba-1');
    expect(serviceMock.remove).toHaveBeenCalledWith('ba-1');
    expect(created.id).toBe('ba-1');
    expect(updated.accountName).toBe('更新户名');
    expect(found.id).toBe('ba-1');
    expect(removed.id).toBe('ba-1');
  });

  it('should map onlyEnabled query correctly and call toggle/set-default', async () => {
    serviceMock.findAll.mockResolvedValueOnce([]);
    serviceMock.findAll.mockResolvedValueOnce([]);
    serviceMock.toggleEnabled.mockResolvedValueOnce({ id: 'ba-2', isEnabled: false });
    serviceMock.setDefault.mockResolvedValueOnce({ id: 'ba-2', isDefault: true });

    await controller.findAll(undefined);
    await controller.findAll('false');
    const toggled = await controller.toggleEnabled('ba-2');
    const defaulted = await controller.setDefault('ba-2');

    expect(serviceMock.findAll).toHaveBeenNthCalledWith(1, true);
    expect(serviceMock.findAll).toHaveBeenNthCalledWith(2, false);
    expect(serviceMock.toggleEnabled).toHaveBeenCalledWith('ba-2');
    expect(serviceMock.setDefault).toHaveBeenCalledWith('ba-2');
    expect(toggled.isEnabled).toBe(false);
    expect(defaulted.isDefault).toBe(true);
  });
});
