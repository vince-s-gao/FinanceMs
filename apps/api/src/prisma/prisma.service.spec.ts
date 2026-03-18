const connectMock = jest.fn();
const disconnectMock = jest.fn();
const prismaCtorMock = jest.fn();

jest.mock('@prisma/client', () => {
  class PrismaClientMock {
    $connect = connectMock;
    $disconnect = disconnectMock;

    constructor(options: unknown) {
      prismaCtorMock(options);
    }
  }

  return {
    PrismaClient: PrismaClientMock,
  };
});

import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
    prismaCtorMock.mockReset();
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should use development log options when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';

    new PrismaService();

    expect(prismaCtorMock).toHaveBeenCalledWith({
      log: ['query', 'error', 'warn'],
    });
  });

  it('should use error-only log options when NODE_ENV is not development', () => {
    process.env.NODE_ENV = 'test';

    new PrismaService();

    expect(prismaCtorMock).toHaveBeenCalledWith({
      log: ['error'],
    });
  });

  it('should connect and log on module init', async () => {
    process.env.NODE_ENV = 'test';
    const service = new PrismaService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await service.onModuleInit();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('📦 数据库连接成功');

    logSpy.mockRestore();
  });

  it('should disconnect and log on module destroy', async () => {
    process.env.NODE_ENV = 'test';
    const service = new PrismaService();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    await service.onModuleDestroy();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith('📦 数据库连接已断开');

    logSpy.mockRestore();
  });
});
