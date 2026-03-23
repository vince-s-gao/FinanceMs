// InfFinanceMs - 部门服务

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePagination } from "../../common/utils/query.utils";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { QueryDepartmentDto } from "./dto/query-department.dto";
import {
  createWithGeneratedCode,
  generatePrefixedCode,
} from "../../common/utils/code-generator.utils";
import { isUniqueConflict as isPrismaUniqueConflict } from "../../common/utils/prisma.utils";

type DepartmentTreeItem = Prisma.DepartmentGetPayload<{
  include: {
    manager: {
      select: { id: true; name: true; email: true };
    };
    _count: {
      select: { members: true };
    };
  };
}> & {
  children: DepartmentTreeItem[];
};

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成部门编号
   */
  private async generateCode(): Promise<string> {
    return generatePrefixedCode({
      model: this.prisma.department,
      field: "code",
      prefix: "DEPT",
      sequenceRegex: /^DEPT(\d{4})$/,
      sequenceLength: 4,
    });
  }

  private isDepartmentCodeConflict(error: unknown): boolean {
    return isPrismaUniqueConflict(error, "code");
  }

  /**
   * 获取部门列表（分页）
   */
  async findAll(query: QueryDepartmentDto) {
    const { page = 1, pageSize = 20, keyword, isActive } = query;
    const {
      page: safePage,
      pageSize: safePageSize,
      skip,
    } = normalizePagination({ page, pageSize });

    const where: Prisma.DepartmentWhereInput = {};

    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: "insensitive" } },
        { name: { contains: keyword, mode: "insensitive" } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        include: {
          parent: {
            select: { id: true, name: true, code: true },
          },
          children: {
            select: { id: true, name: true, code: true },
          },
          _count: {
            select: { children: true },
          },
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil(total / safePageSize),
    };
  }

  /**
   * 获取部门树形结构
   */
  async getTree() {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    // 组装任意层级树，避免固定 include 深度导致的层级截断
    const nodeMap = new Map<string, DepartmentTreeItem>();
    const roots: DepartmentTreeItem[] = [];

    for (const dept of departments) {
      nodeMap.set(dept.id, { ...dept, children: [] });
    }

    for (const dept of departments) {
      const node = nodeMap.get(dept.id);
      if (dept.parentId) {
        const parent = nodeMap.get(dept.parentId);
        if (parent) {
          parent.children.push(node);
          continue;
        }
      }
      roots.push(node);
    }

    const sortTree = (nodes: DepartmentTreeItem[]) => {
      nodes.sort(
        (a, b) =>
          a.sortOrder - b.sortOrder ||
          String(a.name).localeCompare(String(b.name), "zh-CN"),
      );
      nodes.forEach((child) => sortTree(child.children));
    };

    sortTree(roots);
    return roots;
  }

  /**
   * 获取部门选项列表（下拉框用）
   */
  async getOptions() {
    return this.prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        parentId: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /**
   * 获取部门详情
   */
  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        children: {
          select: { id: true, name: true, code: true, isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!department) {
      throw new NotFoundException("部门不存在");
    }

    return department;
  }

  /**
   * 创建部门
   */
  async create(createDepartmentDto: CreateDepartmentDto) {
    const { name, parentId, managerId, sortOrder, remark } =
      createDepartmentDto;

    // 检查名称是否重复
    const existing = await this.prisma.department.findFirst({
      where: { name, parentId: parentId || null },
    });

    if (existing) {
      throw new ConflictException("同级部门下已存在相同名称的部门");
    }

    // 如果有上级部门，检查是否存在
    if (parentId) {
      const parent = await this.prisma.department.findUnique({
        where: { id: parentId },
      });
      if (!parent) {
        throw new BadRequestException("上级部门不存在");
      }
    }

    return createWithGeneratedCode({
      generateCode: () => this.generateCode(),
      create: (code: string) =>
        this.prisma.department.create({
          data: {
            code,
            name,
            parentId,
            managerId,
            sortOrder: sortOrder || 0,
            remark,
          },
        }),
      isCodeConflict: (error) => this.isDepartmentCodeConflict(error),
      exhaustedError: () => new ConflictException("部门编号生成失败，请重试"),
    });
  }

  /**
   * 更新部门
   */
  async update(id: string, updateDepartmentDto: UpdateDepartmentDto) {
    const department = await this.findOne(id);

    const { name, parentId } = updateDepartmentDto;

    // 检查名称是否重复
    if (name && name !== department.name) {
      const existing = await this.prisma.department.findFirst({
        where: {
          name,
          parentId: parentId !== undefined ? parentId : department.parentId,
          id: { not: id },
        },
      });

      if (existing) {
        throw new ConflictException("同级部门下已存在相同名称的部门");
      }
    }

    // 不能将自己设为上级部门
    if (parentId === id) {
      throw new BadRequestException("不能将自己设为上级部门");
    }

    // 不能将子部门设为上级部门
    if (parentId) {
      const isChild = await this.isChildDepartment(id, parentId);
      if (isChild) {
        throw new BadRequestException("不能将子部门设为上级部门");
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: updateDepartmentDto,
    });
  }

  /**
   * 检查是否是子部门
   */
  private async isChildDepartment(
    parentId: string,
    targetId: string,
  ): Promise<boolean> {
    const children = await this.prisma.department.findMany({
      where: { parentId },
      select: { id: true },
    });

    for (const child of children) {
      if (child.id === targetId) {
        return true;
      }
      const isChild = await this.isChildDepartment(child.id, targetId);
      if (isChild) {
        return true;
      }
    }

    return false;
  }

  /**
   * 删除部门
   */
  async remove(id: string) {
    const department = await this.findOne(id);

    // 检查是否有子部门
    if (department.children && department.children.length > 0) {
      throw new BadRequestException("该部门下有子部门，不能删除");
    }

    return this.prisma.department.delete({
      where: { id },
    });
  }

  /**
   * 启用/禁用部门
   */
  async toggleActive(id: string) {
    const department = await this.findOne(id);

    return this.prisma.department.update({
      where: { id },
      data: { isActive: !department.isActive },
    });
  }

  /**
   * 获取部门成员列表
   */
  async getMembers(id: string) {
    const department = await this.findOne(id);

    return this.prisma.user.findMany({
      where: { departmentId: id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * 添加部门成员
   */
  async addMember(departmentId: string, userId: string) {
    await this.findOne(departmentId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId },
    });
  }

  /**
   * 移除部门成员
   */
  async removeMember(departmentId: string, userId: string) {
    await this.findOne(departmentId);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.departmentId !== departmentId) {
      throw new BadRequestException("该用户不属于此部门");
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { departmentId: null },
    });
  }

  /**
   * 设置部门负责人
   */
  async setManager(departmentId: string, userId: string | null) {
    await this.findOne(departmentId);

    if (userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException("用户不存在");
      }

      // 确保用户在该部门
      if (user.departmentId !== departmentId) {
        // 自动将用户加入部门
        await this.prisma.user.update({
          where: { id: userId },
          data: { departmentId },
        });
      }
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: { managerId: userId },
      include: {
        manager: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }

  /**
   * 获取部门详情（含成员和负责人）
   */
  async findOneWithMembers(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        children: {
          select: { id: true, name: true, code: true, isActive: true },
          orderBy: { sortOrder: "asc" },
        },
        manager: {
          select: { id: true, name: true, email: true, phone: true },
        },
        members: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        },
        _count: {
          select: { members: true },
        },
      },
    });

    if (!department) {
      throw new NotFoundException("部门不存在");
    }

    return department;
  }
}
