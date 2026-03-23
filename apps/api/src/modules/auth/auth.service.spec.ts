import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

jest.mock("bcryptjs", () => ({
  compare: jest.fn(),
}));

describe("AuthService", () => {
  let service: AuthService;
  let usersService: any;
  let jwtService: any;
  let configService: any;
  let prisma: any;
  let notificationsService: any;
  let auditService: any;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue("jwt-token"),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === "JWT_REFRESH_EXPIRES_IN") return "30d";
        if (key === "JWT_EXPIRES_IN") return "2h";
        if (key === "AUTH_MAX_LOGIN_ATTEMPTS") return "5";
        if (key === "AUTH_LOCK_MINUTES") return "30";
        return fallback;
      }),
    };
    prisma = {
      user: {
        update: jest.fn().mockResolvedValue({}),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue({}),
    };
    auditService = {
      logLogin: jest.fn().mockResolvedValue({}),
      log: jest.fn().mockResolvedValue({}),
    };

    service = new AuthService(
      usersService,
      jwtService,
      configService,
      prisma,
      notificationsService,
      auditService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (bcrypt.compare as jest.Mock).mockReset();
  });

  it("should reject login when user does not exist", async () => {
    usersService.findByEmail.mockResolvedValueOnce(null);

    await expect(
      service.login({
        email: "missing@example.com",
        password: "Password@123",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should reject login when user is inactive", async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      isActive: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
      password: "Password@123",
    });

    await expect(
      service.login({
        email: "a@example.com",
        password: "Password@123",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should reject login when password is not set", async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      password: "",
    });

    await expect(
      service.login({
        email: "a@example.com",
        password: "Password@123",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should reject login when password is invalid and update failure counter", async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      name: "User A",
      role: "ADMIN",
      departmentId: null,
      avatar: null,
      isActive: true,
      failedLoginAttempts: 1,
      lockedUntil: null,
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      service.login({
        email: "a@example.com",
        password: "WrongPassword@1",
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalled();
  });

  it("should login successfully and return token with projected user info", async () => {
    usersService.findByEmail.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      name: "User A",
      role: "ADMIN",
      departmentId: "d1",
      avatar: "avatar.png",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginIp: "127.0.0.1",
      lastLoginUserAgent: "UA-1",
      password: "hashed",
    });
    (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

    const result = await service.login(
      {
        email: "a@example.com",
        password: "Password@123",
      },
      {
        ipAddress: "127.0.0.1",
        userAgent: "UA-1",
      },
    );

    expect(jwtService.sign).toHaveBeenCalledTimes(2);
    expect(result.accessToken).toBe("jwt-token");
    expect(result.refreshToken).toBe("jwt-token");
    expect(result.user).toEqual({
      id: "u1",
      email: "a@example.com",
      name: "User A",
      role: "ADMIN",
      departmentId: "d1",
      avatar: "avatar.png",
      feishuUserId: undefined,
    });
  });

  it("should reject validateToken when user does not exist", async () => {
    usersService.findById.mockResolvedValueOnce(null);

    await expect(
      service.validateToken({ sub: "missing", sid: "session-1" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should reject validateToken when user is inactive", async () => {
    usersService.findById.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      isActive: false,
    });

    await expect(
      service.validateToken({ sub: "u1", sid: "session-1" }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("should return user when validateToken passes", async () => {
    usersService.findById.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      isActive: true,
    });
    prisma.userSession.findFirst.mockResolvedValueOnce({ id: "session-1" });

    const result = await service.validateToken({ sub: "u1", sid: "session-1" });
    expect(result.id).toBe("u1");
  });

  it("should reject refresh when token verification fails", async () => {
    jwtService.verifyAsync.mockRejectedValueOnce(new Error("bad token"));
    await expect(service.refresh("bad-refresh-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should reject refresh when token type is not refresh", async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: "u1",
      type: "access",
      sid: "session-1",
    });
    await expect(service.refresh("access-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should return new tokens and user when refresh succeeds", async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: "u1",
      type: "refresh",
      sid: "session-1",
    });
    prisma.userSession.findFirst.mockResolvedValueOnce({
      id: "session-1",
      userId: "u1",
      refreshTokenHash: (service as any).hashToken("refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    });
    usersService.findById.mockResolvedValueOnce({
      id: "u1",
      email: "a@example.com",
      name: "User A",
      role: "ADMIN",
      departmentId: "d1",
      avatar: null,
      isActive: true,
    });
    jwtService.sign.mockReset();
    jwtService.sign
      .mockReturnValueOnce("new-access")
      .mockReturnValueOnce("new-refresh");

    const result = await service.refresh("refresh-token");

    expect(result.accessToken).toBe("new-access");
    expect(result.refreshToken).toBe("new-refresh");
    expect(result.user.id).toBe("u1");
  });

  it("should reject refresh when refreshed user is inactive", async () => {
    jwtService.verifyAsync.mockResolvedValueOnce({
      sub: "u2",
      type: "refresh",
      sid: "session-2",
    });
    prisma.userSession.findFirst.mockResolvedValueOnce({
      id: "session-2",
      userId: "u2",
      refreshTokenHash: (service as any).hashToken("refresh-token"),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    });
    usersService.findById.mockResolvedValueOnce({
      id: "u2",
      email: "b@example.com",
      isActive: false,
    });

    await expect(service.refresh("refresh-token")).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("should validate password complexity for invalid and valid inputs", () => {
    const validate = (service as any).validatePasswordComplexity.bind(service);

    expect(() => validate("Aa1!")).toThrow(UnauthorizedException);
    expect(() => validate("abcdefgh")).toThrow(UnauthorizedException);
    expect(() => validate("Password@123")).not.toThrow();
  });

  it("should generate random password with expected length", () => {
    const password = service.generateRandomPassword();
    expect(password).toHaveLength(32);
  });
});
