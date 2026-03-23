import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionsGuard } from "./permissions.guard";
import { PermissionsService } from "../../modules/permissions/permissions.service";

describe("PermissionsGuard", () => {
  const createContext = (user?: { role: string }) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as any;

  let reflector: jest.Mocked<Reflector>;
  let permissionsService: jest.Mocked<PermissionsService>;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;
    permissionsService = {
      getRolePermissions: jest.fn(),
    } as unknown as jest.Mocked<PermissionsService>;
    guard = new PermissionsGuard(reflector, permissionsService);
  });

  it("should allow when no function permission metadata is present", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(
      guard.canActivate(createContext({ role: "ADMIN" })),
    ).resolves.toBe(true);
    expect(permissionsService.getRolePermissions).not.toHaveBeenCalled();
  });

  it("should allow when request user is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(["payment-request.create"]);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(permissionsService.getRolePermissions).not.toHaveBeenCalled();
  });

  it("should allow when user has all required function permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue([
      "payment-request.create",
      "payment-request.submit",
    ]);
    permissionsService.getRolePermissions.mockResolvedValue({
      role: "FINANCE",
      menus: [],
      functions: ["payment-request.create", "payment-request.submit"],
    });

    await expect(
      guard.canActivate(createContext({ role: "FINANCE" })),
    ).resolves.toBe(true);
  });

  it("should reject when user lacks required function permissions", async () => {
    reflector.getAllAndOverride.mockReturnValue(["payment-request.approve"]);
    permissionsService.getRolePermissions.mockResolvedValue({
      role: "FINANCE",
      menus: [],
      functions: ["payment-request.create"],
    });

    await expect(
      guard.canActivate(createContext({ role: "FINANCE" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
