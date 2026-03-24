// InfFinanceMs - 用户服务

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizePagination } from "../../common/utils/query.utils";
import { assertPasswordPolicy } from "../../common/utils/password-policy.utils";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";

type UserOption = {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: {
    id: string;
    name: string;
  } | null;
};

@Injectable()
export class UsersService {
  private readonly optionsCacheTtlMs = 60 * 1000;
  private optionsCache: {
    expiresAt: number;
    items: UserOption[];
  } | null = null;

  constructor(private prisma: PrismaService) {}

  private toRole(value?: string): Role | undefined {
    if (!value) return undefined;
    return (Object.values(Role) as string[]).includes(value)
      ? (value as Role)
      : undefined;
  }

  private getOptionsFromCache(): UserOption[] | null {
    if (!this.optionsCache) return null;
    if (this.optionsCache.expiresAt <= Date.now()) {
      this.optionsCache = null;
      return null;
    }
    return this.optionsCache.items;
  }

  private setOptionsCache(items: UserOption[]) {
    this.optionsCache = {
      expiresAt: Date.now() + this.optionsCacheTtlMs,
      items,
    };
  }

  private invalidateOptionsCache() {
    this.optionsCache = null;
  }

  /**
   * 根据邮箱查找用户
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * 根据ID查找用户
   */
  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * 获取用户列表
   */
  async findAll(params: {
    page?: number;
    pageSize?: number;
    role?: string;
    isActive?: boolean;
  }) {
    const { page = 1, pageSize = 20, role, isActive } = params;
    const {
      page: safePage,
      pageSize: safePageSize,
      skip,
    } = normalizePagination({ page, pageSize });

    const where: Prisma.UserWhereInput = {};
    const normalizedRole = this.toRole(role);
    if (normalizedRole) where.role = normalizedRole;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          departmentId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
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
   * 创建用户
   */
  async create(createUserDto: CreateUserDto) {
    // 检查邮箱是否已存在
    const existingUser = await this.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException("该邮箱已被注册");
    }

    assertPasswordPolicy(
      createUserDto.password,
      (message) => new BadRequestException(message),
    );

    // 加密密码
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    const { departmentId, ...rest } = createUserDto;
    const created = await this.prisma.user.create({
      data: {
        ...rest,
        password: hashedPassword,
        departmentId: departmentId || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        isActive: true,
        createdAt: true,
      },
    });
    this.invalidateOptionsCache();
    return created;
  }

  /**
   * 更新用户
   */
  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 如果更新密码，需要加密
    if (updateUserDto.password) {
      assertPasswordPolicy(
        updateUserDto.password,
        (message) => new BadRequestException(message),
      );
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    const { departmentId, ...rest } = updateUserDto;
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(departmentId !== undefined && {
          departmentId: departmentId || null,
        }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        isActive: true,
        updatedAt: true,
      },
    });
    this.invalidateOptionsCache();
    return updated;
  }

  /**
   * 删除用户（禁用）
   */
  async remove(id: string, operatorId?: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    if (operatorId && operatorId === id) {
      throw new ConflictException("不允许删除当前登录账号");
    }

    if (user.role === "ADMIN" && user.isActive) {
      const activeAdminCount = await this.prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });

      if (activeAdminCount <= 1) {
        throw new ConflictException("系统至少需要保留一个启用状态的管理员");
      }
    }

    const removed = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    this.invalidateOptionsCache();
    return removed;
  }

  /**
   * 获取用户选项列表（用于下拉选择）
   * 返回简化的用户信息，供部门管理等模块使用
   */
  async getOptions() {
    const cached = this.getOptionsFromCache();
    if (cached) return cached;

    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: "asc" },
    });
    this.setOptionsCache(users);
    return users;
  }
}
