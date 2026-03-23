import { ArgumentsHost, HttpException } from "@nestjs/common";
import { HttpExceptionFilter } from "./http-exception.filter";

describe("HttpExceptionFilter", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.restoreAllMocks();
  });

  function createHost(url = "/api/test"): {
    host: ArgumentsHost;
    statusMock: jest.Mock;
    jsonMock: jest.Mock;
  } {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    const response = { status: statusMock };
    const request = {
      method: "GET",
      url,
      headers: {},
      ip: "127.0.0.1",
    };

    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;

    return {
      host,
      statusMock,
      jsonMock,
    };
  }

  it("should hide details and stack in production for 5xx error", () => {
    process.env.NODE_ENV = "production";
    const filter = new HttpExceptionFilter();
    const loggerSpy = jest.spyOn(
      (filter as unknown as { logger: { error: (...args: unknown[]) => void } })
        .logger,
      "error",
    );
    const { host, statusMock, jsonMock } = createHost(
      "/api/contracts?token=abcd",
    );

    filter.catch(new Error("database password=123"), host);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(loggerSpy).toHaveBeenCalled();
    const loggerArgs = loggerSpy.mock.calls[0];
    expect(loggerArgs[1]).toBeUndefined();

    const payload = jsonMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.message).toBe("服务器内部错误，请稍后重试");
    expect(payload).not.toHaveProperty("details");
  });

  it("should keep sanitized details in development", () => {
    process.env.NODE_ENV = "development";
    const filter = new HttpExceptionFilter();
    const { host, statusMock, jsonMock } = createHost("/api/users");

    filter.catch(
      new HttpException(
        {
          message: "创建失败",
          code: "FAILED",
          details: {
            password: "123456",
            token: "abc",
            nested: {
              accessToken: "xyz",
              reason: "invalid",
            },
          },
        },
        400,
      ),
      host,
    );

    expect(statusMock).toHaveBeenCalledWith(400);
    const payload = jsonMock.mock.calls[0][0] as {
      code: string;
      details: Record<string, unknown>;
    };
    expect(payload.code).toBe("FAILED");
    expect(payload.details.password).toBe("***");
    expect(payload.details.token).toBe("***");
    expect(
      (payload.details.nested as Record<string, unknown>).accessToken,
    ).toBe("***");
  });
});
