import { Test } from "@nestjs/testing";
import { ProjectsController } from "../src/modules/projects/projects.controller";
import { ProjectsService } from "../src/modules/projects/projects.service";

describe("ProjectsController Flow (e2e-like)", () => {
  let controller: ProjectsController;

  const serviceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get(ProjectsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should pass query and id parameters", async () => {
    serviceMock.findAll.mockResolvedValueOnce({ items: [], total: 0 });
    serviceMock.findOne.mockResolvedValueOnce({ id: "p1" });

    const query = { page: 1, pageSize: 20, keyword: "项目" } as any;
    const list = await controller.findAll(query);
    const one = await controller.findOne("p1");

    expect(serviceMock.findAll).toHaveBeenCalledWith(query);
    expect(serviceMock.findOne).toHaveBeenCalledWith("p1");
    expect(list.total).toBe(0);
    expect(one.id).toBe("p1");
  });

  it("should create/update/remove project", async () => {
    serviceMock.create.mockResolvedValueOnce({
      id: "p2",
      code: "TKFY20260001",
    });
    serviceMock.update.mockResolvedValueOnce({ id: "p2", name: "项目二-更新" });
    serviceMock.remove.mockResolvedValueOnce({ id: "p2", isDeleted: true });

    const createDto = { name: "项目二", status: "ACTIVE" } as any;
    const updateDto = { name: "项目二-更新" } as any;

    const created = await controller.create(createDto);
    const updated = await controller.update("p2", updateDto);
    const removed = await controller.remove("p2");

    expect(serviceMock.create).toHaveBeenCalledWith(createDto);
    expect(serviceMock.update).toHaveBeenCalledWith("p2", updateDto);
    expect(serviceMock.remove).toHaveBeenCalledWith("p2");
    expect(created.code).toBe("TKFY20260001");
    expect(updated.name).toBe("项目二-更新");
    expect(removed.isDeleted).toBe(true);
  });
});
