import { Test } from "@nestjs/testing";
import { PermissionsController } from "../src/modules/permissions/permissions.controller";
import { PermissionsService } from "../src/modules/permissions/permissions.service";

describe("PermissionsController Flow (e2e-like)", () => {
  let controller: PermissionsController;

  const serviceMock = {
    getAllMenus: jest.fn(),
    getAllFunctions: jest.fn(),
    getAllRolePermissions: jest.fn(),
    getRolePermissions: jest.fn(),
    updateRolePermissions: jest.fn(),
    updateRoleMenuPermissions: jest.fn(),
    updateRoleFunctionPermissions: jest.fn(),
    resetRolePermissions: jest.fn(),
    initializeDefaultPermissions: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [{ provide: PermissionsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(PermissionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should query all permission definitions", async () => {
    serviceMock.getAllMenus.mockResolvedValueOnce([{ key: "dashboard" }]);
    serviceMock.getAllFunctions.mockResolvedValueOnce([
      { key: "contract:create" },
    ]);
    serviceMock.getAllRolePermissions.mockResolvedValueOnce({ ADMIN: {} });

    const menus = await controller.getAllMenus();
    const funcs = await controller.getAllFunctions();
    const allRoles = await controller.getAllRolePermissions();

    expect(serviceMock.getAllMenus).toHaveBeenCalledTimes(1);
    expect(serviceMock.getAllFunctions).toHaveBeenCalledTimes(1);
    expect(serviceMock.getAllRolePermissions).toHaveBeenCalledTimes(1);
    expect(menus[0].key).toBe("dashboard");
    expect(funcs[0].key).toBe("contract:create");
    expect(allRoles.ADMIN).toBeDefined();
  });

  it("should route role-level permission operations", async () => {
    serviceMock.getRolePermissions.mockResolvedValueOnce({ role: "FINANCE" });
    serviceMock.updateRolePermissions.mockResolvedValueOnce({
      role: "FINANCE",
      menus: ["dashboard"],
      functions: ["contract:create"],
    });
    serviceMock.updateRoleMenuPermissions.mockResolvedValueOnce({
      role: "FINANCE",
      menus: ["dashboard"],
      functions: [],
    });
    serviceMock.updateRoleFunctionPermissions.mockResolvedValueOnce({
      role: "FINANCE",
      menus: [],
      functions: ["contract:create"],
    });
    serviceMock.resetRolePermissions.mockResolvedValueOnce({
      role: "FINANCE",
      menus: [],
      functions: [],
    });
    serviceMock.initializeDefaultPermissions.mockResolvedValueOnce({
      message: "初始化完成",
    });

    const role = await controller.getRolePermissions("FINANCE");
    const updatedAll = await controller.updateRolePermissions("FINANCE", {
      menus: ["dashboard"],
      functions: ["contract:create"],
    });
    const updatedMenus = await controller.updateRoleMenuPermissions("FINANCE", {
      menus: ["dashboard"],
    });
    const updatedFuncs = await controller.updateRoleFunctionPermissions(
      "FINANCE",
      {
        functions: ["contract:create"],
      },
    );
    const reset = await controller.resetRolePermissions("FINANCE");
    const initialized = await controller.initializeDefaultPermissions();

    expect(serviceMock.getRolePermissions).toHaveBeenCalledWith("FINANCE");
    expect(serviceMock.updateRolePermissions).toHaveBeenCalledWith(
      "FINANCE",
      ["dashboard"],
      ["contract:create"],
    );
    expect(serviceMock.updateRoleMenuPermissions).toHaveBeenCalledWith(
      "FINANCE",
      ["dashboard"],
    );
    expect(serviceMock.updateRoleFunctionPermissions).toHaveBeenCalledWith(
      "FINANCE",
      ["contract:create"],
    );
    expect(serviceMock.resetRolePermissions).toHaveBeenCalledWith("FINANCE");
    expect(serviceMock.initializeDefaultPermissions).toHaveBeenCalledTimes(1);
    expect(role.role).toBe("FINANCE");
    expect(updatedAll.role).toBe("FINANCE");
    expect(updatedMenus.role).toBe("FINANCE");
    expect(updatedFuncs.role).toBe("FINANCE");
    expect(reset.role).toBe("FINANCE");
    expect(initialized.message).toBe("初始化完成");
  });
});
