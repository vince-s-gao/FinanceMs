import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/auth.service";
import { FeishuService } from "../src/modules/auth/feishu.service";
import { AuditService } from "../src/modules/audit/audit.service";

describe("AuthController Flow (e2e-like)", () => {
  let controller: AuthController;

  const authServiceMock = {
    login: jest.fn(),
    refresh: jest.fn(),
  };

  const feishuServiceMock = {
    getAuthUrl: jest.fn(),
    loginWithFeishu: jest.fn(),
    createLoginTicket: jest.fn(),
    exchangeLoginTicket: jest.fn(),
    bindFeishuAccount: jest.fn(),
    unbindFeishuAccount: jest.fn(),
  };

  const configServiceMock = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === "FRONTEND_URL") return "http://localhost:3000";
      if (key === "NODE_ENV") return "test";
      return defaultValue;
    }),
  };

  const auditServiceMock = {
    log: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: FeishuService, useValue: feishuServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: AuditService, useValue: auditServiceMock },
      ],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return auth url and set oauth state cookie", () => {
    feishuServiceMock.getAuthUrl.mockReturnValueOnce(
      "https://open.feishu.cn/open-apis/authen/v1/authorize?state=test-state",
    );

    const res = {
      cookie: jest.fn(),
    } as any;

    const result = controller.getFeishuAuthUrl(res);

    expect(result.url).toContain(
      "https://open.feishu.cn/open-apis/authen/v1/authorize",
    );
    expect(feishuServiceMock.getAuthUrl).toHaveBeenCalledWith(
      expect.any(String),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      "feishu_oauth_state",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/api/auth/feishu",
      }),
    );
  });

  it("should redirect to state-invalid page when callback state mismatches", async () => {
    const req = {
      headers: {
        cookie: "feishu_oauth_state=good-state",
      },
    } as any;
    const res = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    } as any;

    await controller.feishuCallback("code-1", "bad-state", req, res);

    expect(res.clearCookie).toHaveBeenCalledWith("feishu_oauth_state", {
      path: "/api/auth/feishu",
    });
    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:3000/login?error=feishu_state_invalid",
    );
    expect(feishuServiceMock.loginWithFeishu).not.toHaveBeenCalled();
  });

  it("should redirect with one-time ticket when callback is valid", async () => {
    feishuServiceMock.loginWithFeishu.mockResolvedValueOnce({
      accessToken: "token-1",
      refreshToken: "refresh-1",
      user: {
        id: "u1",
        email: "u1@example.com",
        name: "U1",
        role: "EMPLOYEE",
        departmentId: null,
        avatar: null,
        feishuUserId: "feishu-u1",
      },
    });
    feishuServiceMock.createLoginTicket.mockReturnValueOnce("ticket-123");

    const req = {
      headers: {
        cookie: "feishu_oauth_state=good-state",
      },
    } as any;
    const res = {
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    } as any;

    await controller.feishuCallback("code-2", "good-state", req, res);

    expect(feishuServiceMock.loginWithFeishu).toHaveBeenCalledWith("code-2");
    expect(feishuServiceMock.createLoginTicket).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith(
      "http://localhost:3000/login/callback?ticket=ticket-123",
    );
  });

  it("should exchange ticket via endpoint", async () => {
    feishuServiceMock.exchangeLoginTicket.mockReturnValueOnce({
      accessToken: "token-2",
      refreshToken: "refresh-2",
      user: {
        id: "u2",
        email: "u2@example.com",
        name: "U2",
        role: "EMPLOYEE",
      },
    });

    const req = {
      ip: "127.0.0.1",
      headers: {},
    } as any;
    const res = { cookie: jest.fn() } as any;
    const result = await controller.exchangeFeishuTicket(
      { ticket: "ticket-2" },
      req,
      res,
    );

    expect(feishuServiceMock.exchangeLoginTicket).toHaveBeenCalledWith(
      "ticket-2",
    );
    expect(result.user.id).toBe("u2");
    expect(res.cookie).toHaveBeenCalled();
  });
});
