# InfFinanceMs - 智能财务管理系统

一款面向中小企业的轻量级财务管理系统，以**合同为核心、现金流为主线、报销为费用入口**。

## 🚀 技术栈

- **前端**: Next.js 14+ (App Router)
- **后端**: NestJS
- **数据库**: PostgreSQL
- **ORM**: Prisma
- **包管理**: npm workspaces + Turborepo

## 📁 项目结构

```
InfFinanceMs/
├── apps/
│   ├── web/                    # Next.js 前端应用
│   └── api/                    # NestJS 后端应用
├── packages/
│   ├── database/               # Prisma Schema & 数据库
│   └── shared/                 # 共享类型和工具
└── docs/                       # 项目文档
```

## 🛠️ 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- PostgreSQL >= 14
- npm >= 10.0.0

### 安装步骤

1. **克隆项目**

```bash
git clone <repository-url>
cd InfFinanceMs
```

2. **安装依赖**

```bash
npm install
```

3. **配置环境变量**

```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息
```

4. **初始化数据库**

```bash
# 生成 Prisma Client
npm run db:generate

# 推送数据库结构
npm run db:push

# 初始化种子数据
npm run db:seed
```

5. **启动开发服务器**

```bash
npm run dev
```

## 📋 可用脚本

| 命令                  | 说明               |
| --------------------- | ------------------ |
| `npm run dev`         | 启动所有开发服务器 |
| `npm run build`       | 构建所有应用       |
| `npm run lint`        | 运行代码检查       |
| `npm run test`        | 运行测试           |
| `npm run db:generate` | 生成 Prisma Client |
| `npm run db:push`     | 推送数据库结构     |
| `npm run db:migrate`  | 运行数据库迁移     |
| `npm run db:seed`     | 初始化种子数据     |

## 🔐 测试账号

| 角色   | 邮箱                      | 密码         |
| ------ | ------------------------- | ------------ |
| 管理员 | admin@inffinancems.com    | Admin@123    |
| 财务   | finance@inffinancems.com  | Finance@123  |
| 管理层 | manager@inffinancems.com  | Manager@123  |
| 员工   | employee@inffinancems.com | Employee@123 |

## 📚 API 文档

启动后端服务后，访问 Swagger 文档：

```
http://localhost:3001/api/docs
```

## 📄 产品需求文档

- [PRD（v1.0.1）](./docs/PRODUCT_REQUIREMENTS.md)

## 🏗️ 核心功能模块

### 已完成 ✅

- [x] 用户认证与权限
- [x] 客户管理
- [x] 合同管理（含状态机）
- [x] 回款管理（计划+记录）
- [x] 发票管理
- [x] 报销管理（申请+审批+打款）
- [x] 费用管理
- [x] 报表看板
- [x] 合同详情页面
- [x] 报销新增页面
- [x] 数据导出功能
- [x] 消息通知
- [x] 自动化测试完善

### 待开发 🚧

- [ ] 移动端适配

## 📄 许可证

MIT License
