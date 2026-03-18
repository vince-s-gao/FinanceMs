import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    service = new AuditService(prisma);
  });

  it('should sanitize sensitive fields when logging', async () => {
    await service.log(
      'u1',
      'UPDATE',
      'User',
      'u1',
      {
        password: 'super-secret-password',
        email: 'alice@example.com',
        phone: '13812345678',
        profile: { bankAccount: '6222020202021234' },
      },
      {
        accessToken: 'abc123456789',
        nested: [{ refreshToken: 'refresh-token-value' }],
      },
      '127.0.0.1',
      'ua',
    );

    const createArg = prisma.auditLog.create.mock.calls[0][0];
    expect(createArg.data.oldValue.password).toContain('***');
    expect(createArg.data.oldValue.email).toContain('***@example.com');
    expect(createArg.data.oldValue.phone).toBe('138****5678');
    expect(createArg.data.oldValue.profile.bankAccount).toBe('****1234');
    expect(createArg.data.newValue.accessToken).toContain('***');
    expect(createArg.data.newValue.nested[0].refreshToken).toContain('***');
  });

  it('should not throw when audit logging fails', async () => {
    prisma.auditLog.create.mockRejectedValueOnce(new Error('db down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(
      service.log('u1', 'UPDATE', 'User', 'u1', { password: 'p' }, { token: 't' }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it('should log login success and failure actions', async () => {
    const logSpy = jest.spyOn(service, 'log').mockResolvedValue(undefined);

    await service.logLogin('u1', true, '127.0.0.1');
    await service.logLogin('u1', false, '127.0.0.2');

    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      'u1',
      'LOGIN_SUCCESS',
      'User',
      'u1',
      null,
      expect.objectContaining({ success: true }),
      '127.0.0.1',
      undefined,
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      'u1',
      'LOGIN_FAILED',
      'User',
      'u1',
      null,
      expect.objectContaining({ success: false }),
      '127.0.0.2',
      undefined,
    );
  });

  it('should log access denied event', async () => {
    const logSpy = jest.spyOn(service, 'log').mockResolvedValue(undefined);

    await service.logAccessDenied('u1', 'Contract', 'DELETE', '10.0.0.1', 'UA');

    expect(logSpy).toHaveBeenCalledWith(
      'u1',
      'ACCESS_DENIED',
      'Contract',
      'u1',
      null,
      expect.objectContaining({ action: 'DELETE' }),
      '10.0.0.1',
      'UA',
    );
  });

  it('should log data modification and sensitive operations', async () => {
    const logSpy = jest.spyOn(service, 'log').mockResolvedValue(undefined);

    await service.logDataModification('u1', 'Contract', 'c1', { old: true }, { old: false });
    await service.logSensitiveOperation(
      'u1',
      'EXPORT',
      'Report',
      'r1',
      { format: 'csv' },
      '10.0.0.2',
      'UA2',
    );

    expect(logSpy).toHaveBeenNthCalledWith(
      1,
      'u1',
      'DATA_MODIFIED',
      'Contract',
      'c1',
      { old: true },
      { old: false },
      undefined,
      undefined,
    );
    expect(logSpy).toHaveBeenNthCalledWith(
      2,
      'u1',
      'EXPORT',
      'Report',
      'r1',
      null,
      { format: 'csv' },
      '10.0.0.2',
      'UA2',
    );
  });

  it('should query user audit logs with default and custom limits', async () => {
    await service.getUserAuditLogs('u1');
    await service.getUserAuditLogs('u1', 20);

    expect(prisma.auditLog.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { userId: 'u1' },
        take: 100,
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { userId: 'u1' },
        take: 20,
      }),
    );
  });

  it('should query entity audit logs with default and custom limits', async () => {
    await service.getEntityAuditLogs('Contract', 'c1');
    await service.getEntityAuditLogs('Contract', 'c1', 5);

    expect(prisma.auditLog.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { entityType: 'Contract', entityId: 'c1' },
        take: 100,
      }),
    );
    expect(prisma.auditLog.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { entityType: 'Contract', entityId: 'c1' },
        take: 5,
      }),
    );
  });

  it('should keep primitive and empty values in sanitize helper', () => {
    expect((service as any).sanitizeSensitiveData(null)).toBeNull();
    expect((service as any).sanitizeSensitiveData('plain-text')).toBe('plain-text');
    expect((service as any).sanitizeSensitiveData(123)).toBe(123);
  });

  it('should mask non-string sensitive values as stars', () => {
    const masked = (service as any).maskSensitiveValue('password', 123456);
    expect(masked).toBe('***');
  });

  it('should query paginated audit logs with filters', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([{ id: 'l1' }]);
    prisma.auditLog.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      action: 'UPDATE',
      entityType: 'users',
      userId: 'u1',
      keyword: 'alice',
      sortBy: 'createdAt',
      sortOrder: 'asc',
    } as any);

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'asc' },
      }),
    );
    expect(prisma.auditLog.count).toHaveBeenCalledTimes(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should return audit meta with actions and entityTypes', async () => {
    prisma.auditLog.findMany.mockResolvedValueOnce([
      { entityType: 'users' },
      { entityType: 'contracts' },
    ]);

    const result = await service.getMeta();

    expect(result.actions).toEqual(['LOGIN', 'CREATE', 'UPDATE', 'DELETE']);
    expect(result.entityTypes).toEqual(['users', 'contracts']);
  });
});
