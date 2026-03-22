import { UnauthorizedException } from "@nestjs/common";
import { FeishuService } from "./feishu.service";

describe("FeishuService", () => {
  let service: FeishuService;
  let configService: any;
  let prisma: any;
  let jwtService: any;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === "FEISHU_APP_ID") return "app-id-1";
        if (key === "FEISHU_APP_SECRET") return "app-secret-1";
        if (key === "FEISHU_REDIRECT_URI")
          return "https://example.com/callback";
        if (key === "JWT_REFRESH_EXPIRES_IN") return "30d";
        return fallback;
      }),
    };

    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue("jwt-token-1"),
    };

    service = new FeishuService(configService, prisma, jwtService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should generate Feishu auth URL with required params", () => {
    const url = service.getAuthUrl("state-123");
    expect(url).toContain(
      "https://open.feishu.cn/open-apis/authen/v1/authorize?",
    );
    expect(url).toContain("app_id=app-id-1");
    expect(url).toContain("state=state-123");
    expect(url).toContain("redirect_uri=");
  });

  it("should create and exchange login ticket once", () => {
    const payload = {
      accessToken: "token-a",
      refreshToken: "refresh-a",
      user: {
        id: "u1",
        email: "a@example.com",
        name: "A",
        role: "EMPLOYEE",
        departmentId: null,
        avatar: null,
        feishuUserId: "f-1",
      },
    };

    const ticket = service.createLoginTicket(payload);
    const first = service.exchangeLoginTicket(ticket);
    expect(first).toEqual(payload);
    expect(() => service.exchangeLoginTicket(ticket)).toThrow(
      UnauthorizedException,
    );
  });

  it("should cleanup expired tickets when creating a new ticket", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-17T00:00:00.000Z"));

    const expiredTicket = service.createLoginTicket({
      accessToken: "expired-token",
      refreshToken: "expired-refresh-token",
      user: {
        id: "u-expired",
        email: "expired@example.com",
        name: "Expired",
        role: "EMPLOYEE",
        departmentId: null,
        avatar: null,
        feishuUserId: null,
      },
    });

    jest.setSystemTime(new Date("2026-03-17T00:02:00.000Z"));
    const validTicket = service.createLoginTicket({
      accessToken: "new-token",
      refreshToken: "new-refresh-token",
      user: {
        id: "u-valid",
        email: "valid@example.com",
        name: "Valid",
        role: "EMPLOYEE",
        departmentId: null,
        avatar: null,
        feishuUserId: null,
      },
    });

    expect(() => service.exchangeLoginTicket(expiredTicket)).toThrow(
      UnauthorizedException,
    );
    expect(service.exchangeLoginTicket(validTicket).accessToken).toBe(
      "new-token",
    );
    jest.useRealTimers();
  });

  it("should reject expired login ticket", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-17T00:00:00.000Z"));

    const ticket = service.createLoginTicket({
      accessToken: "token-b",
      refreshToken: "refresh-b",
      user: {
        id: "u2",
        email: "b@example.com",
        name: "B",
        role: "EMPLOYEE",
        departmentId: null,
        avatar: null,
        feishuUserId: "f-2",
      },
    });

    jest.setSystemTime(new Date("2026-03-17T00:02:00.000Z"));
    expect(() => service.exchangeLoginTicket(ticket)).toThrow(
      UnauthorizedException,
    );
    jest.useRealTimers();
  });

  it("should get app access token successfully", async () => {
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        app_access_token: "app-token-1",
      }),
    } as any);

    const token = await (service as any).getAppAccessToken();
    expect(token).toBe("app-token-1");
  });

  it("should throw when getting app access token fails", async () => {
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 999,
        msg: "fail",
      }),
    } as any);

    await expect((service as any).getAppAccessToken()).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should throw when user access token response has non-zero code", async () => {
    jest
      .spyOn(service as any, "getAppAccessToken")
      .mockResolvedValueOnce("app-token-1");
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 1001,
        msg: "invalid code",
        data: { access_token: "x" },
      }),
    } as any);

    await expect(
      (service as any).getUserAccessToken("bad-code"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should throw when user access token response misses data", async () => {
    jest
      .spyOn(service as any, "getAppAccessToken")
      .mockResolvedValueOnce("app-token-1");
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        msg: "ok",
      }),
    } as any);

    await expect(
      (service as any).getUserAccessToken("bad-code"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should return user access token data on success", async () => {
    jest
      .spyOn(service as any, "getAppAccessToken")
      .mockResolvedValueOnce("app-token-1");
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          access_token: "user-token",
          token_type: "Bearer",
          expires_in: 7200,
          refresh_token: "refresh-token",
          refresh_expires_in: 86400,
        },
      }),
    } as any);

    const tokenData = await (service as any).getUserAccessToken("good-code");
    expect(tokenData.access_token).toBe("user-token");
  });

  it("should throw when getFeishuUserInfo response has non-zero code", async () => {
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 3001,
        msg: "invalid token",
        data: { user: { open_id: "x" } },
      }),
    } as any);

    await expect(
      (service as any).getFeishuUserInfo("bad-token"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should throw when getFeishuUserInfo response misses user data", async () => {
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        msg: "ok",
        data: {},
      }),
    } as any);

    await expect(
      (service as any).getFeishuUserInfo("bad-token"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should return user info when getFeishuUserInfo succeeds", async () => {
    jest.spyOn(globalThis, "fetch" as any).mockResolvedValueOnce({
      json: async () => ({
        code: 0,
        data: {
          user: {
            open_id: "open-4",
            user_id: "user-4",
            union_id: "union-4",
            name: "赵六",
            email: "zhao@example.com",
            mobile: "13800001234",
            avatar_url: "avatar-4",
            tenant_key: "tenant-1",
          },
        },
      }),
    } as any);

    const user = await (service as any).getFeishuUserInfo("good-token");
    expect(user.open_id).toBe("open-4");
  });

  it("should create user on first login and return jwt payload", async () => {
    jest.spyOn(service as any, "getUserAccessToken").mockResolvedValueOnce({
      access_token: "user-token",
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: "refresh",
      refresh_expires_in: 86400,
    });
    jest.spyOn(service as any, "getFeishuUserInfo").mockResolvedValueOnce({
      open_id: "open-1",
      union_id: "union-1",
      user_id: "user-1",
      name: "张三",
      email: undefined,
      mobile: "13800001111",
      avatar_url: "avatar-url",
      tenant_key: "tenant-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({
      id: "local-1",
      email: "open-1@feishu.local",
      name: "张三",
      role: "EMPLOYEE",
      isActive: true,
      departmentId: null,
      avatar: "avatar-url",
      feishuUserId: "user-1",
    });

    const result = await service.loginWithFeishu("code-1");

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "open-1@feishu.local",
          feishuOpenId: "open-1",
        }),
      }),
    );
    expect(jwtService.sign).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sub: "local-1",
        email: "open-1@feishu.local",
        role: "EMPLOYEE",
        type: "access",
      }),
    );
    expect(jwtService.sign).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sub: "local-1",
        email: "open-1@feishu.local",
        role: "EMPLOYEE",
        type: "refresh",
      }),
      { expiresIn: "30d" },
    );
    expect(result.accessToken).toBe("jwt-token-1");
    expect(result.refreshToken).toBe("jwt-token-1");
    expect(result.user.id).toBe("local-1");
  });

  it("should update existing user on feishu login", async () => {
    jest.spyOn(service as any, "getUserAccessToken").mockResolvedValueOnce({
      access_token: "user-token",
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: "refresh",
      refresh_expires_in: 86400,
    });
    jest.spyOn(service as any, "getFeishuUserInfo").mockResolvedValueOnce({
      open_id: "open-2",
      union_id: "union-2",
      user_id: "user-2",
      name: "李四",
      email: "li@example.com",
      mobile: "13900002222",
      avatar_url: "new-avatar",
      tenant_key: "tenant-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "local-2",
      email: "li@example.com",
      name: "李四",
      role: "ADMIN",
      isActive: true,
      departmentId: "d1",
      avatar: "old-avatar",
      phone: "13000000000",
    });
    prisma.user.update.mockResolvedValueOnce({
      id: "local-2",
      email: "li@example.com",
      name: "李四",
      role: "ADMIN",
      isActive: true,
      departmentId: "d1",
      avatar: "new-avatar",
      phone: "13900002222",
      feishuUserId: "user-2",
    });

    const result = await service.loginWithFeishu("code-2");

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "local-2" },
        data: expect.objectContaining({
          feishuOpenId: "open-2",
          feishuUnionId: "union-2",
        }),
      }),
    );
    expect(result.user.id).toBe("local-2");
    expect(result.user.role).toBe("ADMIN");
  });

  it("should reject feishu login when user is inactive", async () => {
    jest.spyOn(service as any, "getUserAccessToken").mockResolvedValueOnce({
      access_token: "user-token",
      token_type: "Bearer",
      expires_in: 7200,
      refresh_token: "refresh",
      refresh_expires_in: 86400,
    });
    jest.spyOn(service as any, "getFeishuUserInfo").mockResolvedValueOnce({
      open_id: "open-3",
      union_id: "union-3",
      user_id: "user-3",
      name: "王五",
      email: "wang@example.com",
      tenant_key: "tenant-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce({
      id: "local-3",
      email: "wang@example.com",
      name: "王五",
      role: "EMPLOYEE",
      isActive: false,
      departmentId: null,
      avatar: null,
      phone: null,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: "local-3",
      email: "wang@example.com",
      name: "王五",
      role: "EMPLOYEE",
      isActive: false,
      departmentId: null,
      avatar: null,
      phone: null,
      feishuUserId: "user-3",
    });

    await expect(service.loginWithFeishu("code-3")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should reject bind when feishu account already bound", async () => {
    jest.spyOn(service as any, "getUserAccessToken").mockResolvedValueOnce({
      access_token: "token-x",
    });
    jest.spyOn(service as any, "getFeishuUserInfo").mockResolvedValueOnce({
      open_id: "open-x",
      union_id: "union-x",
      user_id: "user-x",
      name: "X",
      tenant_key: "tenant-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce({ id: "other-user" });

    await expect(
      service.bindFeishuAccount("current-user", "code-x"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should bind feishu account successfully", async () => {
    jest.spyOn(service as any, "getUserAccessToken").mockResolvedValueOnce({
      access_token: "token-y",
    });
    jest.spyOn(service as any, "getFeishuUserInfo").mockResolvedValueOnce({
      open_id: "open-y",
      union_id: "union-y",
      user_id: "user-y",
      name: "Y",
      tenant_key: "tenant-1",
    });
    prisma.user.findFirst.mockResolvedValueOnce(null);
    prisma.user.update.mockResolvedValueOnce({
      id: "u-bind",
      feishuUserId: "user-y",
    });

    const result = await service.bindFeishuAccount("u-bind", "code-y");
    expect(result).toEqual({
      message: "飞书账号绑定成功",
      feishuUserId: "user-y",
    });
  });

  it("should reject unbind when user not exists or has no password", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.unbindFeishuAccount("missing")).rejects.toThrow(
      UnauthorizedException,
    );

    prisma.user.findUnique.mockResolvedValueOnce({ id: "u1", password: null });
    await expect(service.unbindFeishuAccount("u1")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should unbind feishu account successfully", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "u1",
      password: "hashed",
    });
    prisma.user.update.mockResolvedValueOnce({ id: "u1" });

    const result = await service.unbindFeishuAccount("u1");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        feishuUserId: null,
        feishuOpenId: null,
        feishuUnionId: null,
      },
    });
    expect(result).toEqual({ message: "飞书账号解绑成功" });
  });
});
