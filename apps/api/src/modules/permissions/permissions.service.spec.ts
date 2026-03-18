import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };

    service = new PermissionsService(prisma);
  });

  it('should return default permissions when db has no configuration', async () => {
    prisma.rolePermission.findMany.mockResolvedValueOnce([]);

    const result = await service.getRolePermissions('ADMIN');

    expect(result.role).toBe('ADMIN');
    expect(result.menus).toContain('/dashboard');
    expect(result.functions).toContain('expense.create');
  });

  it('should return empty defaults for unknown role without db config', async () => {
    prisma.rolePermission.findMany.mockResolvedValueOnce([]);

    const result = await service.getRolePermissions('UNKNOWN_ROLE');
    expect(result).toEqual({
      role: 'UNKNOWN_ROLE',
      menus: [],
      functions: [],
    });
  });

  it('should return menu and function definitions', () => {
    const menus = service.getAllMenus();
    const functions = service.getAllFunctions();

    expect(menus.length).toBeGreaterThan(0);
    expect(functions.length).toBeGreaterThan(0);
    expect(menus[0]).toHaveProperty('key');
    expect(functions[0]).toHaveProperty('module');
  });

  it('should build permissions from db entries', async () => {
    prisma.rolePermission.findMany.mockResolvedValueOnce([
      { permType: 'menu', permKey: '/dashboard', isEnabled: true },
      { permType: 'menu', permKey: '/settings', isEnabled: false },
      { permType: 'function', permKey: 'expense.create', isEnabled: true },
    ]);

    const result = await service.getRolePermissions('ADMIN');

    expect(result.menus).toEqual(['/dashboard']);
    expect(result.functions).toEqual(['expense.create']);
  });

  it('should update role menu permissions and return latest role permissions', async () => {
    const rolePermissionsSpy = jest
      .spyOn(service, 'getRolePermissions')
      .mockResolvedValueOnce({ role: 'SALES', menus: ['/dashboard'], functions: [] });

    const result = await service.updateRoleMenuPermissions('SALES', ['/dashboard']);

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: 'SALES', permType: 'menu' },
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        {
          role: 'SALES',
          permType: 'menu',
          permKey: '/dashboard',
          isEnabled: true,
        },
      ],
    });
    expect(rolePermissionsSpy).toHaveBeenCalledWith('SALES');
    expect(result.role).toBe('SALES');
  });

  it('should clear function permissions when input is empty', async () => {
    const rolePermissionsSpy = jest
      .spyOn(service, 'getRolePermissions')
      .mockResolvedValueOnce({ role: 'EMPLOYEE', menus: [], functions: [] });

    await service.updateRoleFunctionPermissions('EMPLOYEE', []);

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: 'EMPLOYEE', permType: 'function' },
    });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
    expect(rolePermissionsSpy).toHaveBeenCalledWith('EMPLOYEE');
  });

  it('should create function permissions when input is non-empty', async () => {
    const rolePermissionsSpy = jest
      .spyOn(service, 'getRolePermissions')
      .mockResolvedValueOnce({ role: 'FINANCE', menus: [], functions: ['expense.approve'] });

    await service.updateRoleFunctionPermissions('FINANCE', ['expense.approve']);

    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        {
          role: 'FINANCE',
          permType: 'function',
          permKey: 'expense.approve',
          isEnabled: true,
        },
      ],
    });
    expect(rolePermissionsSpy).toHaveBeenCalledWith('FINANCE');
  });

  it('should batch update menus and functions in one transaction', async () => {
    jest.spyOn(service, 'getRolePermissions').mockResolvedValueOnce({
      role: 'FINANCE',
      menus: ['/dashboard'],
      functions: ['expense.pay'],
    });

    await service.updateRolePermissions('FINANCE', ['/dashboard'], ['expense.pay']);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: 'FINANCE' },
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ permType: 'menu', permKey: '/dashboard' }),
          expect.objectContaining({ permType: 'function', permKey: 'expense.pay' }),
        ]),
      }),
    );
  });

  it('should initialize defaults only for roles without existing records', async () => {
    prisma.rolePermission.findFirst.mockImplementation(async ({ where }: any) =>
      where.role === 'EMPLOYEE' ? null : { id: 'existing' },
    );

    const result = await service.initializeDefaultPermissions();

    expect(prisma.rolePermission.createMany).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ message: '初始化完成' });
  });

  it('should aggregate all role permissions', async () => {
    jest
      .spyOn(service, 'getRolePermissions')
      .mockResolvedValueOnce({ role: 'EMPLOYEE', menus: ['/dashboard'], functions: [] })
      .mockResolvedValueOnce({ role: 'SALES', menus: ['/customers'], functions: ['customer.create'] })
      .mockResolvedValueOnce({ role: 'FINANCE', menus: ['/reports'], functions: ['expense.pay'] })
      .mockResolvedValueOnce({ role: 'MANAGER', menus: ['/contracts'], functions: ['contract.edit'] })
      .mockResolvedValueOnce({ role: 'ADMIN', menus: ['/settings'], functions: ['user.edit'] });

    const result = await service.getAllRolePermissions();

    expect(Object.keys(result)).toEqual(['EMPLOYEE', 'SALES', 'FINANCE', 'MANAGER', 'ADMIN']);
    expect(result.ADMIN.menus).toEqual(['/settings']);
  });

  it('should reset role permissions to defaults', async () => {
    const result = await service.resetRolePermissions('SALES');

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: 'SALES' },
    });
    expect(result.role).toBe('SALES');
    expect(result.menus).toContain('/customers');
  });

  it('should reset unknown role permissions to empty defaults', async () => {
    const result = await service.resetRolePermissions('UNKNOWN_ROLE');

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { role: 'UNKNOWN_ROLE' },
    });
    expect(result).toEqual({
      role: 'UNKNOWN_ROLE',
      menus: [],
      functions: [],
    });
  });
});
