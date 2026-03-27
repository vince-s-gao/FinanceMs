const connectMock = jest.fn();
const disconnectMock = jest.fn();
const onMock = jest.fn();
const prismaCtorMock = jest.fn();

jest.mock("@prisma/client", () => {
  class PrismaClientMock {
    $connect = connectMock;
    $disconnect = disconnectMock;
    $on = onMock;

    constructor(options: unknown) {
      prismaCtorMock(options);
    }
  }

  return {
    PrismaClient: PrismaClientMock,
  };
});

import { PrismaService } from "./prisma.service";
import { Logger } from "@nestjs/common";

describe("PrismaService", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    connectMock.mockReset();
    disconnectMock.mockReset();
    onMock.mockReset();
    prismaCtorMock.mockReset();
    delete process.env.PRISMA_LOG_QUERY;
    delete process.env.SLOW_QUERY_THRESHOLD_MS;
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should use development log options when NODE_ENV is development", () => {
    process.env.NODE_ENV = "development";

    new PrismaService();

    expect(prismaCtorMock).toHaveBeenCalledWith({
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ],
    });
    expect(onMock).toHaveBeenCalledWith("query", expect.any(Function));
  });

  it("should use error-only log options when NODE_ENV is not development", () => {
    process.env.NODE_ENV = "test";

    new PrismaService();

    expect(prismaCtorMock).toHaveBeenCalledWith({
      log: [{ emit: "stdout", level: "error" }],
    });
    expect(onMock).not.toHaveBeenCalled();
  });

  it("should enable query tracking by env even when not in development", () => {
    process.env.NODE_ENV = "test";
    process.env.PRISMA_LOG_QUERY = "true";

    new PrismaService();

    expect(prismaCtorMock).toHaveBeenCalledWith({
      log: [
        { emit: "event", level: "query" },
        { emit: "stdout", level: "error" },
        { emit: "stdout", level: "warn" },
      ],
    });
    expect(onMock).toHaveBeenCalledWith("query", expect.any(Function));
  });

  it("should log slow query when duration exceeds threshold", () => {
    process.env.NODE_ENV = "development";
    process.env.SLOW_QUERY_THRESHOLD_MS = "100";
    const warnSpy = jest
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    new PrismaService();
    const handler = onMock.mock.calls[0][1] as (event: {
      duration: number;
      query: string;
    }) => void;
    handler({
      duration: 120,
      query: "select   * \n from users where id = ?",
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "Slow query detected (120ms): select * from users where id = ?",
    );
    warnSpy.mockRestore();
  });

  it("should connect and log on module init", async () => {
    process.env.NODE_ENV = "test";
    const service = new PrismaService();
    const logSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("数据库连接成功");

    logSpy.mockRestore();
  });

  it("should disconnect and log on module destroy", async () => {
    process.env.NODE_ENV = "test";
    const service = new PrismaService();
    const logSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);

    await service.onModuleDestroy();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith("数据库连接已断开");

    logSpy.mockRestore();
  });
});
