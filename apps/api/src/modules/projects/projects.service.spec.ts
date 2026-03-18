import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      project: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    service = new ProjectsService(prisma);
  });

  it('should fallback to createdAt when sortBy is invalid', async () => {
    await service.findAll({
      sortBy: 'invalidField',
      sortOrder: 'desc',
    } as any);

    const findManyArg = prisma.project.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('should respect allowed sortBy field', async () => {
    await service.findAll({
      sortBy: 'name',
      sortOrder: 'asc',
    } as any);

    const findManyArg = prisma.project.findMany.mock.calls[0][0];
    expect(findManyArg.orderBy).toEqual({ name: 'asc' });
  });

  it('should apply keyword/status filters and pagination in findAll', async () => {
    prisma.project.findMany.mockResolvedValueOnce([{ id: 'p1' }]);
    prisma.project.count.mockResolvedValueOnce(1);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      keyword: '财务',
      status: 'ACTIVE',
    } as any);

    expect(prisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isDeleted: false,
          status: 'ACTIVE',
          OR: expect.any(Array),
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('should throw when findOne project does not exist', async () => {
    prisma.project.findFirst.mockResolvedValueOnce(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('should return project details when findOne succeeds', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({
      id: 'p1',
      code: 'TKFY20260001',
      name: '项目A',
      expenses: [],
    });

    const result = await service.findOne('p1');
    expect(result.id).toBe('p1');
  });

  it('should create project with generated code and normalized dates', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ code: 'TKFY20260009' });
    prisma.project.create.mockResolvedValueOnce({ id: 'p1' });

    await service.create({
      code: 'SHOULD_BE_IGNORED',
      name: '新项目',
      startDate: '2026-03-01',
      endDate: '2026-12-31',
    } as any);

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'TKFY20260010',
          name: '新项目',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      }),
    );
  });

  it('should create project with sequence 0001 when last code suffix is invalid', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ code: 'TKFY2026ABCD' });
    prisma.project.create.mockResolvedValueOnce({ id: 'p-invalid-seq' });

    await service.create({
      name: '无效后缀项目',
    } as any);

    const data = prisma.project.create.mock.calls[0][0].data;
    expect(data.code).toMatch(/^TKFY\d{4}0001$/);
    expect(data.startDate).toBeUndefined();
    expect(data.endDate).toBeUndefined();
  });

  it('should retry create when generated project code conflicts once', async () => {
    prisma.project.findFirst.mockResolvedValue({ code: 'TKFY20260011' });
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['code'] };

    prisma.project.create
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({ id: 'p-retry-ok' });

    await service.create({
      name: '冲突重试项目',
    } as any);

    expect(prisma.project.create).toHaveBeenCalledTimes(2);
  });

  it('should throw business conflict when generated project code conflicts in all retries', async () => {
    prisma.project.findFirst.mockResolvedValue({ code: 'TKFY20260011' });
    const conflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    conflictError.code = 'P2002';
    conflictError.meta = { target: ['code'] };
    prisma.project.create.mockRejectedValue(conflictError);

    await expect(
      service.create({
        name: '冲突失败项目',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw original error when create fails with non-code conflict', async () => {
    prisma.project.findFirst.mockResolvedValueOnce({ code: 'TKFY20260011' });
    const originalError = new Error('db unavailable');
    prisma.project.create.mockRejectedValueOnce(originalError);

    await expect(
      service.create({
        name: '异常项目',
      } as any),
    ).rejects.toThrow('db unavailable');
  });

  it('should evaluate isProjectCodeConflict helper branches', () => {
    expect((service as any).isProjectCodeConflict(new Error('x'))).toBe(false);

    const nonConflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    nonConflictError.code = 'P2025';
    nonConflictError.meta = { target: ['code'] };
    expect((service as any).isProjectCodeConflict(nonConflictError)).toBe(false);

    const wrongTargetError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    wrongTargetError.code = 'P2002';
    wrongTargetError.meta = { target: ['name'] };
    expect((service as any).isProjectCodeConflict(wrongTargetError)).toBe(false);

    const missingMetaError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    missingMetaError.code = 'P2002';
    expect((service as any).isProjectCodeConflict(missingMetaError)).toBe(false);

    const codeConflictError = Object.create((Prisma as any).PrismaClientKnownRequestError.prototype);
    codeConflictError.code = 'P2002';
    codeConflictError.meta = { target: ['code'] };
    expect((service as any).isProjectCodeConflict(codeConflictError)).toBe(true);
  });

  it('should throw when update target project does not exist', async () => {
    jest.spyOn(service, 'findOne').mockRejectedValueOnce(new NotFoundException('项目不存在'));

    await expect(service.update('missing', { name: 'x' } as any)).rejects.toThrow(NotFoundException);
  });

  it('should update existing project and ignore code field', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: 'p1' } as any);
    prisma.project.update.mockResolvedValueOnce({ id: 'p1' });

    await service.update('p1', {
      code: 'SHOULD_BE_IGNORED',
      name: '更新后项目',
      startDate: '2026-04-01',
      endDate: '2026-11-30',
    } as any);

    expect(prisma.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({
          name: '更新后项目',
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        }),
      }),
    );
    const data = prisma.project.update.mock.calls[0][0].data;
    expect(data.code).toBeUndefined();
  });

  it('should keep date fields undefined when update dto omits dates', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: 'p2' } as any);
    prisma.project.update.mockResolvedValueOnce({ id: 'p2' });

    await service.update('p2', { name: '仅更新名称' } as any);

    const data = prisma.project.update.mock.calls[0][0].data;
    expect(data.startDate).toBeUndefined();
    expect(data.endDate).toBeUndefined();
  });

  it('should soft delete project in remove', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValueOnce({ id: 'p1' } as any);
    prisma.project.update.mockResolvedValueOnce({ id: 'p1', isDeleted: true });

    await service.remove('p1');

    expect(prisma.project.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isDeleted: true },
    });
  });
});
