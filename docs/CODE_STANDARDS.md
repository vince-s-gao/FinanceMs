# InfFinanceMs - 代码规范

> 本文档基于项目现有代码总结，作为团队开发的统一规范参考。

## 目录

1. [项目结构规范](#1-项目结构规范)
2. [命名规范](#2-命名规范)
3. [后端开发规范 (NestJS)](#3-后端开发规范-nestjs)
4. [前端开发规范 (Next.js + React)](#4-前端开发规范-nextjs--react)
5. [数据库规范 (Prisma)](#5-数据库规范-prisma)
6. [API 设计规范](#6-api-设计规范)
7. [注释规范](#7-注释规范)
8. [Git 提交规范](#8-git-提交规范)

---

## 1. 项目结构规范

### 1.1 Monorepo 结构

```
InfFinanceMs/
├── apps/
│   ├── api/                    # 后端 NestJS 应用
│   │   └── src/
│   │       ├── common/         # 公共模块（守卫、拦截器、装饰器）
│   │       ├── modules/        # 业务模块
│   │       ├── prisma/         # Prisma 服务
│   │       └── app.module.ts   # 根模块
│   └── web/                    # 前端 Next.js 应用
│       └── src/
│           ├── app/            # 页面路由
│           ├── components/     # 公共组件
│           ├── lib/            # 工具函数
│           └── stores/         # 状态管理
├── packages/
│   └── database/               # 数据库包（Prisma Schema）
├── scripts/                    # 脚本文件
└── docs/                       # 文档
```

### 1.2 后端模块结构

每个业务模块应包含以下文件：

```
modules/
└── [module-name]/
    ├── [module-name].module.ts      # 模块定义
    ├── [module-name].controller.ts  # 控制器
    ├── [module-name].service.ts     # 服务层
    └── dto/                         # 数据传输对象
        ├── create-[name].dto.ts
        ├── update-[name].dto.ts
        └── query-[name].dto.ts
```

### 1.3 前端页面结构

```
app/
└── (dashboard)/
    └── [module-name]/
        ├── page.tsx              # 列表页
        ├── new/
        │   └── page.tsx          # 新增页
        └── [id]/
            ├── page.tsx          # 详情页
            └── edit/
                └── page.tsx      # 编辑页
```

---

## 2. 命名规范

### 2.1 文件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| 模块文件 | kebab-case | `projects.module.ts` |
| 组件文件 | PascalCase | `MainLayout.tsx` |
| 工具函数 | camelCase | `formatDate.ts` |
| 常量文件 | camelCase | `constants.ts` |
| DTO 文件 | kebab-case | `create-project.dto.ts` |

### 2.2 变量命名

```typescript
// ✅ 正确
const projectList = [];           // 普通变量：camelCase
const PROJECT_STATUS = {};        // 常量：UPPER_SNAKE_CASE
interface ProjectDto {}           // 接口/类型：PascalCase
function fetchProjects() {}       // 函数：camelCase
class ProjectsService {}          // 类：PascalCase

// ❌ 错误
const project_list = [];
const projectSTATUS = {};
```

### 2.3 数据库字段命名

```prisma
// ✅ 正确：使用 camelCase
model Project {
  id          String   @id
  projectName String   // camelCase
  createdAt   DateTime // camelCase
  isDeleted   Boolean  // 布尔值以 is/has/can 开头
}

// 表名映射使用 snake_case
@@map("projects")
```

---

## 3. 后端开发规范 (NestJS)

### 3.1 模块定义

```typescript
// InfFinanceMs - 项目模块

import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],  // 如需被其他模块使用则导出
})
export class ProjectsModule {}
```

### 3.2 控制器规范

```typescript
// InfFinanceMs - 项目控制器

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('项目管理')           // Swagger 分组
@ApiBearerAuth()              // 需要认证
@UseGuards(JwtAuthGuard)      // 应用守卫
@Controller('projects')        // 路由前缀
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: '获取项目列表' })
  findAll(@Query() query: QueryProjectDto) {
    return this.projectsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取项目详情' })
  findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建项目' })
  create(@Body() createDto: CreateProjectDto) {
    return this.projectsService.create(createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新项目' })
  update(@Param('id') id: string, @Body() updateDto: UpdateProjectDto) {
    return this.projectsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除项目' })
  remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }
}
```

### 3.3 服务层规范

```typescript
// InfFinanceMs - 项目服务

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取项目列表
   * 支持分页、关键词搜索、状态筛选
   */
  async findAll(query: QueryProjectDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    
    const skip = (page - 1) * pageSize;
    const where: any = { isDeleted: false };

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ];
    }

    // 状态筛选
    if (status) {
      where.status = status;
    }

    // 并行查询数据和总数
    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取项目详情
   */
  async findOne(id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, isDeleted: false },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    return project;
  }

  /**
   * 创建项目
   */
  async create(createDto: CreateProjectDto) {
    // 检查唯一性约束
    if (createDto.code) {
      const existing = await this.prisma.project.findUnique({
        where: { code: createDto.code },
      });
      if (existing) {
        throw new ConflictException('项目编号已存在');
      }
    }

    return this.prisma.project.create({
      data: createDto,
    });
  }

  /**
   * 删除项目（软删除）
   */
  async remove(id: string) {
    await this.findOne(id);  // 先验证存在性

    return this.prisma.project.update({
      where: { id },
      data: { isDeleted: true },
    });
  }
}
```

### 3.4 DTO 规范

```typescript
// InfFinanceMs - 创建项目DTO

import { IsString, IsOptional, IsIn, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// 定义枚举常量
const PROJECT_STATUS = ['ACTIVE', 'COMPLETED', 'SUSPENDED', 'CANCELLED'] as const;
type ProjectStatus = typeof PROJECT_STATUS[number];

export class CreateProjectDto {
  @ApiPropertyOptional({ description: '项目编号（不填则自动生成）' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({ description: '项目名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '项目描述' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '项目状态', enum: PROJECT_STATUS })
  @IsOptional()
  @IsIn(PROJECT_STATUS)
  status?: ProjectStatus;

  @ApiPropertyOptional({ description: '开始日期' })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}
```

### 3.5 查询 DTO 规范

```typescript
// InfFinanceMs - 查询项目DTO

import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryProjectDto {
  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: '关键词搜索' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: '排序字段' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: '排序方向', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
```

---

## 4. 前端开发规范 (Next.js + React)

### 4.1 页面组件结构

```tsx
'use client';

// InfFinanceMs - 项目管理页面

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, Button, message, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { api } from '@/lib/api';

const { Title } = Typography;

// 类型定义
interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
}

// 常量定义
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '进行中',
  COMPLETED: '已完成',
};

export default function ProjectsPage() {
  // 路由
  const router = useRouter();
  
  // 状态定义
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 数据加载
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/projects', { params: { page, pageSize } });
      setProjects(res.items || []);
      setTotal(res.total || 0);
    } catch (error: any) {
      message.error(error.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 副作用
  useEffect(() => {
    fetchProjects();
  }, [page, pageSize]);

  // 事件处理
  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/projects/${id}`);
      message.success('删除成功');
      fetchProjects();
    } catch (error: any) {
      message.error(error.message || '删除失败');
    }
  };

  // 表格列定义
  const columns = [
    { title: '项目编号', dataIndex: 'code', key: 'code' },
    { title: '项目名称', dataIndex: 'name', key: 'name' },
    // ...
  ];

  // 渲染
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Title level={4} className="!mb-0">项目管理</Title>
        <Button type="primary" icon={<PlusOutlined />}>
          新增项目
        </Button>
      </div>
      
      <Table
        columns={columns}
        dataSource={projects}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
}
```

### 4.2 组件代码顺序

```tsx
// 1. 'use client' 声明（如需要）
'use client';

// 2. 文件头注释
// InfFinanceMs - 组件名称

// 3. 导入语句（按顺序）
import { useState, useEffect } from 'react';        // React
import { useRouter } from 'next/navigation';        // Next.js
import { Button, Table } from 'antd';               // UI 库
import { PlusOutlined } from '@ant-design/icons';   // 图标
import { api } from '@/lib/api';                    // 内部模块

// 4. 类型定义
interface Props {}
interface DataType {}

// 5. 常量定义
const STATUS_MAP = {};

// 6. 组件定义
export default function ComponentName() {
  // 6.1 Hooks（路由、状态、表单等）
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // 6.2 数据获取函数
  const fetchData = async () => {};

  // 6.3 副作用
  useEffect(() => {}, []);

  // 6.4 事件处理函数
  const handleSubmit = async () => {};
  const handleDelete = async () => {};

  // 6.5 渲染辅助（列定义、选项等）
  const columns = [];

  // 6.6 返回 JSX
  return <div>...</div>;
}
```

### 4.3 状态管理规范

```typescript
// stores/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);

// 辅助函数
export const isAdmin = (user: User | null) => user?.role === 'ADMIN';
export const isFinance = (user: User | null) => 
  ['FINANCE', 'ADMIN'].includes(user?.role || '');
```

### 4.4 API 调用规范

```typescript
// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async get<T>(url: string, options?: { params?: Record<string, any> }): Promise<T> {
    const queryString = options?.params 
      ? '?' + new URLSearchParams(options.params).toString() 
      : '';
    const response = await fetch(`${BASE_URL}${url}${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || '请求失败');
    }
    return data;
  }
}

export const api = new ApiClient();
```

---

## 5. 数据库规范 (Prisma)

### 5.1 模型定义规范

```prisma
/// 项目表
model Project {
  id          String        @id @default(cuid())  // 主键使用 cuid
  code        String        @unique               // 唯一编号
  name        String                              // 名称
  description String?                             // 可选字段用 ?
  status      ProjectStatus @default(ACTIVE)      // 枚举类型
  startDate   DateTime?                           // 日期类型
  endDate     DateTime?
  isDeleted   Boolean       @default(false)       // 软删除标记
  createdAt   DateTime      @default(now())       // 创建时间
  updatedAt   DateTime      @updatedAt            // 更新时间

  // 关联关系
  expenses    Expense[]                           // 一对多关系

  @@map("projects")                               // 表名映射
}

/// 项目状态枚举
enum ProjectStatus {
  ACTIVE      // 进行中
  COMPLETED   // 已完成
  SUSPENDED   // 已暂停
  CANCELLED   // 已取消
}
```

### 5.2 关联关系规范

```prisma
// 一对多关系
model Contract {
  id         String    @id @default(cuid())
  customerId String
  customer   Customer  @relation(fields: [customerId], references: [id])
  
  @@map("contracts")
}

model Customer {
  id        String     @id @default(cuid())
  contracts Contract[]  // 反向关联
  
  @@map("customers")
}

// 多对多关系（通过中间表）
model User {
  id    String @id @default(cuid())
  roles UserRole[]
}

model Role {
  id    String @id @default(cuid())
  users UserRole[]
}

model UserRole {
  userId String
  roleId String
  user   User @relation(fields: [userId], references: [id])
  role   Role @relation(fields: [roleId], references: [id])
  
  @@id([userId, roleId])
}
```

### 5.3 索引规范

```prisma
model Dictionary {
  id   String @id @default(cuid())
  type String
  code String

  @@unique([type, code])  // 复合唯一索引
  @@index([type])         // 普通索引
  @@map("dictionaries")
}
```

---

## 6. API 设计规范

### 6.1 RESTful 路由设计

| 操作 | HTTP 方法 | 路由 | 说明 |
|------|-----------|------|------|
| 列表 | GET | `/projects` | 获取列表（支持分页、筛选） |
| 详情 | GET | `/projects/:id` | 获取单条记录 |
| 创建 | POST | `/projects` | 创建新记录 |
| 更新 | PUT | `/projects/:id` | 全量更新 |
| 部分更新 | PATCH | `/projects/:id` | 部分更新 |
| 删除 | DELETE | `/projects/:id` | 删除记录 |
| 特殊操作 | PATCH | `/projects/:id/submit` | 状态变更等操作 |

### 6.2 响应格式规范

```typescript
// 列表响应
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20,
  "totalPages": 5
}

// 单条记录响应
{
  "id": "xxx",
  "name": "项目名称",
  ...
}

// 错误响应
{
  "statusCode": 400,
  "message": "错误信息",
  "error": "Bad Request"
}
```

### 6.3 查询参数规范

```
GET /projects?page=1&pageSize=20&keyword=测试&status=ACTIVE&sortBy=createdAt&sortOrder=desc
```

---

## 7. 注释规范

### 7.1 文件头注释

```typescript
// InfFinanceMs - 模块/功能名称
// 简要描述（可选）
```

### 7.2 函数注释

```typescript
/**
 * 获取项目列表
 * 支持分页、关键词搜索、状态筛选
 * @param query 查询参数
 * @returns 分页结果
 */
async findAll(query: QueryProjectDto) {
  // ...
}
```

### 7.3 行内注释

```typescript
// 检查唯一性约束
if (createDto.code) {
  // ...
}

const where: any = {
  isDeleted: false,  // 排除已删除记录
};
```

---

## 8. Git 提交规范

### 8.1 提交信息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 8.2 Type 类型

| 类型 | 说明 |
|------|------|
| feat | 新功能 |
| fix | 修复 Bug |
| docs | 文档更新 |
| style | 代码格式（不影响功能） |
| refactor | 重构 |
| test | 测试相关 |
| chore | 构建/工具相关 |

### 8.3 示例

```
feat(projects): 添加项目管理模块

- 新增项目 CRUD 接口
- 新增项目管理页面
- 报销单关联项目字段

Closes #123
```

---

## 附录：常用代码片段

### A.1 分页查询模板

```typescript
async findAll(query: QueryDto) {
  const { page = 1, pageSize = 20, keyword, sortBy = 'createdAt', sortOrder = 'desc' } = query;
  const skip = (page - 1) * pageSize;
  const where: any = { isDeleted: false };

  if (keyword) {
    where.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    this.prisma.model.findMany({ where, skip, take: pageSize, orderBy: { [sortBy]: sortOrder } }),
    this.prisma.model.count({ where }),
  ]);

  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
```

### A.2 前端列表页模板

```tsx
const [loading, setLoading] = useState(false);
const [data, setData] = useState([]);
const [total, setTotal] = useState(0);
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(20);

const fetchData = async () => {
  setLoading(true);
  try {
    const res = await api.get('/endpoint', { params: { page, pageSize } });
    setData(res.items);
    setTotal(res.total);
  } catch (error) {
    message.error('加载失败');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { fetchData(); }, [page, pageSize]);
```

---

*文档版本: 1.0.0*
*最后更新: 2026-01-22*
