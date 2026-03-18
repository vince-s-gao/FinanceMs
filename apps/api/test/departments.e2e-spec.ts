import { Test } from '@nestjs/testing';
import { DepartmentsController } from '../src/modules/departments/departments.controller';
import { DepartmentsService } from '../src/modules/departments/departments.service';

describe('DepartmentsController Flow (e2e-like)', () => {
  let controller: DepartmentsController;

  const serviceMock = {
    findAll: jest.fn(),
    getTree: jest.fn(),
    getOptions: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    toggleActive: jest.fn(),
    remove: jest.fn(),
    getMembers: jest.fn(),
    findOneWithMembers: jest.fn(),
    addMember: jest.fn(),
    removeMember: jest.fn(),
    setManager: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [{ provide: DepartmentsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(DepartmentsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should query list/tree/options', async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });
    serviceMock.getTree.mockResolvedValueOnce([{ id: 'd-root' }]);
    serviceMock.getOptions.mockResolvedValueOnce([{ id: 'd-root', name: '总部' }]);

    const query = { page: 1, pageSize: 20 } as any;
    const list = await controller.findAll(query);
    const tree = await controller.getTree();
    const options = await controller.getOptions();

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(serviceMock.getTree).toHaveBeenCalledTimes(1);
    expect(serviceMock.getOptions).toHaveBeenCalledTimes(1);
    expect(list.total).toBe(0);
    expect(tree[0].id).toBe('d-root');
    expect(options[0].name).toBe('总部');
  });

  it('should create/update/toggle/remove department', async () => {
    serviceMock.create.mockResolvedValueOnce({ id: 'd1' });
    serviceMock.update.mockResolvedValueOnce({ id: 'd1', name: '市场部-更新' });
    serviceMock.toggleActive.mockResolvedValueOnce({ id: 'd1', isActive: false });
    serviceMock.remove.mockResolvedValueOnce({ id: 'd1' });

    const createDto = { name: '市场部' } as any;
    const updateDto = { name: '市场部-更新' } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update('d1', updateDto);
    const toggled = await controller.toggleActive('d1');
    const removed = await controller.remove('d1');

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith('d1', updateDto);
    expect(serviceMock.toggleActive).toHaveBeenCalledWith('d1');
    expect(serviceMock.remove).toHaveBeenCalledWith('d1');
    expect(created.id).toBe('d1');
    expect(updated.name).toBe('市场部-更新');
    expect(toggled.isActive).toBe(false);
    expect(removed.id).toBe('d1');
  });

  it('should handle member and manager operations', async () => {
    serviceMock.getMembers.mockResolvedValueOnce([{ id: 'u1' }]);
    serviceMock.findOneWithMembers.mockResolvedValueOnce({ id: 'd2', members: [{ id: 'u1' }] });
    serviceMock.addMember.mockResolvedValueOnce({ id: 'u2', departmentId: 'd2' });
    serviceMock.removeMember.mockResolvedValueOnce({ id: 'u2', departmentId: null });
    serviceMock.setManager.mockResolvedValueOnce({ id: 'd2', managerId: 'u1' });

    const members = await controller.getMembers('d2');
    const detail = await controller.findOneWithMembers('d2');
    const added = await controller.addMember('d2', 'u2');
    const removed = await controller.removeMember('d2', 'u2');
    const managerSet = await controller.setManager('d2', 'u1');

    expect(serviceMock.getMembers).toHaveBeenCalledWith('d2');
    expect(serviceMock.findOneWithMembers).toHaveBeenCalledWith('d2');
    expect(serviceMock.addMember).toHaveBeenCalledWith('d2', 'u2');
    expect(serviceMock.removeMember).toHaveBeenCalledWith('d2', 'u2');
    expect(serviceMock.setManager).toHaveBeenCalledWith('d2', 'u1');
    expect(members[0].id).toBe('u1');
    expect(detail.id).toBe('d2');
    expect(added.departmentId).toBe('d2');
    expect(removed.departmentId).toBeNull();
    expect(managerSet.managerId).toBe('u1');
  });
});
