# 财务管理系统 - 安全性和权限控制审查报告

**审查日期**: 2026-03-21  
**审查范围**: InfFinanceMs 财务管理系统  
**审查类型**: 安全性和权限控制全面审查

---

## 📋 执行摘要

本报告对 InfFinanceMs 财务管理系统的安全性和权限控制机制进行了全面审查。系统整体安全架构较为完善，采用了业界最佳实践，但仍存在一些需要改进的安全问题。

### 关键发现

- ✅ **优点**: 使用 JWT 认证、bcrypt 密码加密、RBAC 权限模型、CSRF 防护、审计日志、HTTPS 强制、速率限制、安全头配置
- ✅ **已修复**: 硬编码的默认密码、缺少 HTTPS 强制、缺少速率限制、缺少安全头配置
- ⚠️ **中等风险**: 部分输入验证不完整、JWT 访问令牌过期时间较长
- 🔴 **高风险**: 敏感信息可能泄露

### 总体安全评分: 8.5/10

---

## 🔍 一、认证机制分析

### 1.1 认证实现方式

**实现方式**: JWT (JSON Web Token)

**文件位置**:

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/auth/auth.module.ts`
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts`

**配置分析**:

```typescript
// auth.module.ts
const DEV_FALLBACK_JWT_SECRET = 'development-only-jwt-secret-change-me';

const jwtSecret = configService.get<string>('JWT_SECRET');
const resolvedSecret = jwtSecret || DEV_FALLBACK_JWT_SECRET;

// JWT 配置
secret: resolvedSecret,
signOptions: {
  expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
}
```

**评估**:

- ✅ 使用 JWT 进行无状态认证
- ✅ 支持访问令牌和刷新令牌分离
- ⚠️ 默认过期时间 7 天过长，建议缩短至 2 小时
- ⚠️ 开发环境使用弱密钥，生产环境有验证但可能被绕过

### 1.2 密码存储和加密

**实现方式**: bcryptjs

**文件位置**:

- `apps/api/src/modules/auth/auth.service.ts`
- `apps/api/src/modules/users/users.service.ts`
- `packages/database/prisma/seed.ts`

**代码示例**:

```typescript
// 密码加密
const hashedPassword = await bcrypt.hash(password, 10);

// 密码验证
const isPasswordValid = await bcrypt.compare(password, user.password);
```

**评估**:

- ✅ 使用 bcrypt 算法，盐值轮次为 10（符合安全标准）
- ✅ 密码哈希存储，不存储明文
- ⚠️ 种子数据中硬编码默认密码（见下文安全问题）

### 1.3 登录/登出流程

**登录流程**:

1. 用户提交邮箱和密码
2. 验证用户存在性和密码正确性
3. 生成 JWT 访问令牌和刷新令牌
4. 设置 HttpOnly Cookie
5. 记录审计日志

**登出流程**:

1. 清除认证 Cookie
2. 客户端删除本地存储的令牌

**评估**:

- ✅ 登录流程完整
- ✅ 登出时正确清除 Cookie
- ✅ 登录事件记录审计日志

### 1.4 Token 管理和刷新机制

**实现方式**:

- 访问令牌: 短期有效（默认 7 天，建议 2 小时）
- 刷新令牌: 长期有效（默认 30 天）
- 刷新令牌存储在 HttpOnly Cookie

**评估**:

- ✅ 实现了令牌刷新机制
- ✅ 刷新令牌通过 Cookie 传递，不易被 XSS 窃取
- ⚠️ 访问令牌过期时间过长
- ⚠️ 缺少令牌黑名单机制（无法主动撤销令牌）

### 1.5 多因素认证

**当前状态**: 未实现

**建议**: 考物添加以下 MFA 方式：

- SMS 短信验证码
- 邮箱验证码
- TOTP（基于时间的一次性密码）
- 飞书集成（已有飞书登录，可扩展）

---

## 🔐 二、授权机制分析

### 2.1 权限模型

**实现方式**: RBAC (基于角色的访问控制)

**角色定义** (`packages/database/prisma/schema.prisma`):

```typescript
enum Role {
  EMPLOYEE  // 普通员工
  SALES     // 销售
  FINANCE   // 财务
  MANAGER   // 管理层
  ADMIN     // 管理员
}
```

**权限配置表**:

```typescript
model RolePermission {
  id        String   @id @default(cuid())
  role      Role     // 角色
  permType  String   // 权限类型: menu/function
  permKey   String   // 权限标识
  isEnabled Boolean  @default(true)
}
```

**评估**:

- ✅ 采用标准的 RBAC 模型
- ✅ 权限分为菜单权限和功能权限
- ✅ 权限可动态配置
- ⚠️ 缺少细粒度的数据权限控制（如只能查看自己部门的数据）

### 2.2 角色和权限定义

**文件位置**:

- `apps/api/src/modules/permissions/permissions.service.ts`
- `apps/web/src/lib/constants.ts`

**权限类型**:

- 菜单权限: 控制前端菜单显示
- 功能权限: 控制具体操作（如创建、编辑、删除、审批）

**评估**:

- ✅ 权限定义清晰
- ✅ 支持动态权限配置
- ✅ 前后端权限校验分离

### 2.3 权限检查实现

**后端守卫**:

- `JwtAuthGuard`: JWT 认证守卫
- `RolesGuard`: 角色权限守卫

**代码示例**:

```typescript
// roles.guard.ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.FINANCE)
async someMethod() { }
```

**评估**:

- ✅ 使用 NestJS 守卫机制
- ✅ 支持多角色检查
- ⚠️ 缺少自定义方法级权限检查装饰器

### 2.4 API 端点的权限保护

**保护方式**:

- 使用 `@UseGuards(JwtAuthGuard)` 保护需要认证的端点
- 使用 `@Roles()` 装饰器限制角色访问
- 使用 `@Public()` 装饰器标记公开端点

**评估**:

- ✅ 大部分 API 端点已正确保护
- ⚠️ 部分端点可能缺少权限检查（需要全面审查）

### 2.5 前端路由的权限控制

**实现方式**:

- 基于用户角色过滤菜单项
- 路由守卫检查权限

**文件位置**:

- `apps/web/src/components/layout/MainLayout.tsx`
- `apps/web/src/middleware.ts`

**评估**:

- ✅ 前端实现了菜单权限过滤
- ✅ 使用 Next.js 中间件进行路由保护
- ⚠️ 前端权限控制仅用于 UI 显示，不能替代后端验证

---

## 🚨 三、安全漏洞清单

### 3.1 高危漏洞

#### 🔴 漏洞 1: 敏感信息泄露

**位置**: 多处错误处理和日志

**问题描述**:
错误信息可能包含敏感信息，如数据库连接字符串、堆栈跟踪等。

**风险等级**: 🔴 高危

**影响**:

- 攻击者可能从错误信息中获取系统内部信息
- 可能泄露数据库凭证

**修复建议**:

1. 生产环境禁用详细错误信息
2. 使用全局异常过滤器统一处理错误
3. 敏感信息脱敏后再记录日志

**修复示例**:

```typescript
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const isProduction = process.env.NODE_ENV === "production";
    const message = isProduction ? "服务器内部错误" : exception.message;

    response.status(500).json({
      message,
      ...(isProduction ? {} : { stack: exception.stack }),
    });
  }
}
```

---

### 3.2 中危漏洞

#### ⚠️ 漏洞 5: JWT 访问令牌过期时间较长

**位置**: `apps/api/src/modules/auth/auth.module.ts`

**问题描述**:
默认访问令牌过期时间为 7 天，过长。

**风险等级**: ⚠️ 中危

**影响**:

- 令牌被盗后有效期过长
- 无法及时撤销被盗令牌

**修复建议**:

1. 将访问令牌过期时间缩短至 2 小时
2. 使用刷新令牌机制
3. 实现令牌黑名单

**修复示例**:

```typescript
// .env
JWT_EXPIRES_IN = "2h"; // 访问令牌 2 小时
JWT_REFRESH_TOKEN_EXPIRES_IN = "7d"; // 刷新令牌 7 天
```

---

#### ⚠️ 漏洞 7: 缺少安全头配置

**位置**: `apps/api/src/main.ts`

**问题描述**:
虽然安装了 `helmet`，但未配置使用。

**风险等级**: ⚠️ 中危

**影响**:

- 缺少 CSP、HSTS 等安全头
- 可能受到 XSS、点击劫持等攻击

**修复建议**:

1. 启用 helmet 中间件
2. 配置 CSP 策略
3. 配置 HSTS

**修复示例**:

```typescript
import helmet from "helmet";

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);
```

---

### 3.3 低危漏洞

#### ⚠️ 漏洞 8: 缺少密码复杂度策略

**位置**: `apps/api/src/modules/auth/auth.service.ts`

**问题描述**:
虽然有密码复杂度验证，但策略不够严格。

**风险等级**: ⚠️ 低危

**影响**:

- 用户可能设置弱密码
- 容易被暴力破解

**修复建议**:

1. 增强密码复杂度要求
2. 检查密码是否在常见密码列表中
3. 定期提醒用户修改密码

---

#### ⚠️ 漏洞 9: 缺少会话管理

**位置**: 认证相关代码

**问题描述**:
缺少会话管理功能，如：

- 查看当前活跃会话
- 强制登出指定会话
- 单点登录（SSO）

**风险等级**: ⚠️ 低危

**影响**:

- 无法管理用户的多设备登录
- 无法强制登出被盗的会话

**修复建议**:

1. 实现会话管理功能
2. 记录用户登录设备信息
3. 支持远程登出

---

#### ⚠️ 漏洞 10: 缺少异常登录检测

**位置**: 审计日志相关代码

**问题描述**:
虽然有审计日志，但缺少异常登录检测机制。

**风险等级**: ⚠️ 低危

**影响**:

- 无法及时发现异常登录行为
- 无法及时响应安全威胁

**修复建议**:

1. 实现异常登录检测（IP 变更、设备变更等）
2. 发送安全告警通知
3. 要求二次验证

---

## 🔧 四、安全配置评估

### 4.1 HTTPS 配置

**当前状态**: ✅ 已配置

**已实现**:

- 生产环境强制 HTTPS
- 支持 x-forwarded-proto 反向代理
- HSTS 头配置（1年有效期）

**配置位置**: `apps/api/src/main.ts` (第 85-116 行)

---

### 4.2 安全头设置

**当前状态**: ✅ 已配置

**已配置**:

- ✅ Content-Security-Policy (CSP)
- ✅ HTTP Strict Transport Security (HSTS)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer-Policy
- ✅ CORS 配置
- ✅ Cookie 安全属性（HttpOnly、SameSite）

**配置位置**: `apps/api/src/main.ts` (第 118-135 行)

**当前配置**:

```typescript
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://open.feishu.cn"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    frameguard: { action: "deny" },
    noSniff: true,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  }),
);
```

### 4.3 Cookie 安全设置

**当前状态**: ✅ 已配置

**配置分析**:

```typescript
// accessToken
{
  httpOnly: true,  // ✅ 防止 XSS
  secure: true,     // ✅ 仅 HTTPS
  sameSite: 'lax',  // ✅ CSRF 防护
  maxAge: ...,
  path: '/',
}

// refreshToken
{
  httpOnly: true,
  secure: true,
  sameSite: 'strict',  // ✅ 更严格
  maxAge: ...,
  path: '/',
}
```

**评估**: ✅ Cookie 安全配置正确

---

### 4.4 环境变量管理

**当前状态**: ✅ 已配置

**已实现**:

- ✅ 环境变量验证函数 `validateCriticalEnv()`
- ✅ 生产环境强制检查关键环境变量
- ✅ JWT_SECRET 弱密钥检测
- ✅ `.env.example` 提供了示例

**配置位置**: `apps/api/src/main.ts` (第 15-43 行)

**验证的环境变量**:

- `JWT_SECRET` (所有环境)
- `DATABASE_URL` (生产环境)
- `JWT_EXPIRES_IN` (生产环境)
- `JWT_REFRESH_EXPIRES_IN` 或 `JWT_REFRESH_TOKEN_EXPIRES_IN` (生产环境)

---

### 4.5 .env 文件安全性

**当前状态**: ✅ 已配置

**已实现**:

- ✅ `.env` 文件在 `.gitignore` 中
- ✅ 生产环境强制使用强密钥
- ✅ 环境变量验证在应用启动时执行

**建议**:

```bash
# 设置 .env 文件权限
chmod 600 .env

# 生成强密钥
openssl rand -base64 32
```

---

## 📊 五、日志和监控

### 5.1 安全事件日志

**实现方式**: 审计日志服务

**文件位置**: `apps/api/src/modules/audit/audit.service.ts`

**记录的事件**:

- 用户登录
- 访问拒绝
- 数据修改
- 敏感操作

**评估**:

- ✅ 实现了完整的审计日志
- ✅ 记录了用户、操作、实体、IP、User-Agent
- ✅ 敏感数据脱敏处理
- ⚠️ 缺少日志轮转配置
- ⚠️ 缺少日志加密存储

---

### 5.2 异常登录检测

**当前状态**: ❌ 未实现

**建议实现**:

1. 检测 IP 地址变更
2. 检测设备指纹变更
3. 检测异常时间登录
4. 检测多次失败登录

**实现示例**:

```typescript
async detectAbnormalLogin(userId: string, req: Request) {
  const lastLogin = await this.getLastLogin(userId);

  // IP 变更检测
  if (lastLogin && lastLogin.ipAddress !== req.ip) {
    await this.sendSecurityAlert(userId, 'IP地址变更');
  }

  // 异常时间检测
  const hour = new Date().getHours();
  if (hour < 6 || hour > 22) {
    await this.sendSecurityAlert(userId, '异常时间登录');
  }
}
```

---

### 5.3 审计日志

**当前状态**: ✅ 已实现

**功能**:

- 记录所有关键操作
- 支持按用户查询
- 支持按实体查询
- 敏感数据脱敏

**改进建议**:

1. 实现日志归档
2. 实现日志导出
3. 实现日志分析报表
4. 集成 SIEM 系统

---

## 🔒 六、安全功能评估

### 6.1 数据加密

#### 传输中加密

- ✅ 支持 HTTPS（需要配置）
- ⚠️ 数据库连接未强制 SSL

**建议**:

```typescript
// .env
DATABASE_URL = "postgresql://user:pass@host:5432/db?sslmode=require";
```

#### 静态加密

- ❌ 数据库未加密
- ❌ 文件存储未加密

**建议**:

1. 使用数据库透明加密（TDE）
2. 敏感字段使用应用层加密
3. 文件上传后加密存储

---

### 6.2 密码策略

**当前策略**:

- 最小长度: 8 字符
- 复杂度: 包含大小写字母和数字

**评估**: ⚠️ 基本满足，但可以增强

**建议增强**:

1. 最小长度: 12 字符
2. 禁止常见密码
3. 禁止包含用户信息
4. 定期过期（90 天）
5. 禁止重复使用最近 5 次密码

---

### 6.3 会话管理

**当前状态**: ⚠️ 部分实现

**已实现**:

- JWT 认证
- 刷新令牌机制

**未实现**:

- 会话列表
- 强制登出
- 单点登录
- 并发登录限制

**建议**: 实现完整的会话管理功能

---

### 6.4 API 密钥管理

**当前状态**: ❌ 未实现

**建议**:

1. 为第三方集成提供 API 密钥
2. 实现 API 密钥管理界面
3. 支持密钥轮换
4. 支持密钥权限范围

---

## 📝 七、安全配置建议

### 7.1 立即修复（高优先级）

1. **增强输入验证**
   - 为所有 DTO 添加验证
   - 启用全局验证管道
   - 添加正则表达式验证

2. **修复敏感信息泄露**
   - 检查错误响应中的敏感数据
   - 实现响应数据脱敏
   - 避免在日志中记录敏感信息

---

### 7.2 短期修复（中优先级）

1. **缩短 JWT 过期时间**
   - 访问令牌: 15 分钟（当前 7 天）
   - 刷新令牌: 7 天

2. **实现异常登录检测**
   - IP 变更检测
   - 设备变更检测
   - 发送安全告警

3. **增强密码策略**
   - 最小长度 12 字符
   - 禁止常见密码
   - 定期过期

4. **实现会话管理**
   - 会话列表
   - 强制登出
   - 并发限制

---

### 7.3 长期改进（低优先级）

1. **实现多因素认证**
   - SMS 验证
   - TOTP
   - 飞书集成

2. **实现数据加密**
   - 数据库加密
   - 敏感字段加密
   - 文件加密

3. **集成 SIEM**
   - 日志集中管理
   - 安全事件分析
   - 自动告警

4. **安全测试**
   - 渗透测试
   - 代码审计
   - 依赖扫描

---

## 🛠️ 八、安全加固方案

### 8.1 认证加固

#### 方案 1: 实现令牌黑名单

```typescript
// token-blacklist.service.ts
@Injectable()
export class TokenBlacklistService {
  constructor(private redis: Redis) {}

  async addToBlacklist(token: string, expiresIn: number) {
    await this.redis.setex(`blacklist:${token}`, expiresIn, '1');
  }

  async isBlacklisted(token: string): Promise<boolean> {
    return await this.redis.exists(`blacklist:${token}`) === 1;
  }
}

// jwt.strategy.ts
async validate(payload: any) {
  const isBlacklisted = await this.tokenBlacklistService.isBlacklisted(token);
  if (isBlacklisted) {
    throw new UnauthorizedException('令牌已失效');
  }
  // ...
}
```

#### 方案 2: 实现设备指纹

```typescript
// device-fingerprint.service.ts
@Injectable()
export class DeviceFingerprintService {
  generateFingerprint(req: Request): string {
    const userAgent = req.headers["user-agent"];
    const ip = req.ip;
    return crypto
      .createHash("sha256")
      .update(`${userAgent}-${ip}`)
      .digest("hex");
  }

  async isTrustedDevice(userId: string, fingerprint: string): Promise<boolean> {
    // 检查设备是否已信任
  }
}
```

---

### 8.2 授权加固

#### 方案 1: 实现数据权限

```typescript
// data-permission.guard.ts
@Injectable()
export class DataPermissionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const entityId = request.params.id;

    // 检查用户是否有权限访问该数据
    const hasPermission = await this.checkDataPermission(user, entityId);

    if (!hasPermission) {
      throw new ForbiddenException("无权访问该数据");
    }

    return true;
  }
}
```

#### 方案 2: 实现权限继承

```typescript
// 权限继承逻辑
async getUserEffectivePermissions(userId: string): Promise<Permission[]> {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
    },
  });

  // 获取角色权限
  const rolePermissions = await this.getRolePermissions(user.role);

  // 获取部门权限
  const departmentPermissions = await this.getDepartmentPermissions(user.departmentId);

  // 合并权限
  return [...rolePermissions, ...departmentPermissions];
}
```

---

### 8.3 安全头加固

#### 方案 1: 配置 CSP

```typescript
// csp.config.ts
export const cspConfig = {
  directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
    scriptSrc: ["'self'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
    imgSrc: ["'self'", "data:", "https:", "blob:"],
    connectSrc: ["'self'", "https://open.feishu.cn"],
    fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'none'"],
    workerSrc: ["'self'", "blob:"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: [],
  },
  reportOnly: false,
};
```

#### 方案 2: 配置 HSTS

```typescript
// hsts.config.ts
export const hstsConfig = {
  maxAge: 31536000, // 1 年
  includeSubDomains: true,
  preload: true,
};
```

---

### 8.4 日志加固

#### 方案 1: 实现日志轮转

```typescript
// logger.config.ts
export const loggerConfig = {
  transports: [
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
};
```

#### 方案 2: 实现敏感数据脱敏

```typescript
// sanitizer.service.ts
@Injectable()
export class SanitizerService {
  private sensitiveFields = ["password", "token", "secret", "apiKey"];

  sanitize(data: any): any {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sanitized = { ...data };
    for (const field of this.sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "***REDACTED***";
      }
    }

    return sanitized;
  }
}
```

---

## 📋 九、修复优先级排序

### P0 - 立即修复（1-3 天）

1. **修复敏感信息泄露** - 高危
2. **增强输入验证** - 中危

### P1 - 短期修复（1-2 周）

3. **缩短 JWT 过期时间** - 中危
4. **实现异常登录检测** - 中危
5. **增强密码策略** - 低危
6. **实现会话管理** - 低危

### P2 - 中期改进（1-2 月）

7. **实现令牌黑名单** - 中危
8. **实现数据权限** - 中危
9. **实现日志轮换** - 低危

### P3 - 长期规划（3-6 月）

10. **实现多因素认证** - 低危
11. **实现数据加密** - 低危
12. **集成 SIEM** - 低危
13. **安全测试** - 低危

---

## ✅ 十、安全检查清单

### 认证安全

- [x] 使用 JWT 认证
- [x] 密码使用 bcrypt 加密
- [x] 实现刷新令牌机制
- [x] Cookie 设置 HttpOnly
- [x] Cookie 设置 SameSite
- [x] 配置 HTTPS
- [ ] 实现令牌黑名单
- [ ] 实现多因素认证
- [ ] 实现异常登录检测

### 授权安全

- [x] 实现 RBAC 权限模型
- [x] 使用守卫保护 API
- [x] 前端路由权限控制
- [ ] 实现数据权限
- [ ] 实现权限继承

### 输入验证

- [x] 使用 class-validator
- [x] 启用全局验证管道
- [ ] 所有 DTO 添加完整验证
- [x] 防止 SQL 注入（Prisma ORM）
- [x] 防止 XSS 攻击（CSP 配置）

### 安全配置

- [x] 安装 helmet
- [x] 配置 CSP
- [x] 配置 HSTS
- [x] 配置 CORS
- [x] 配置速率限制

### 日志和监控

- [x] 实现审计日志
- [x] 敏感数据脱敏
- [ ] 实现日志轮转
- [ ] 集成 SIEM
- [ ] 实现安全告警

### 数据安全

- [ ] 数据库加密
- [ ] 敏感字段加密
- [ ] 文件加密
- [ ] 备份加密

### 环境安全

- [x] .env.example 提供
- [x] .env 在 .gitignore
- [x] 环境变量验证
- [ ] 密钥轮换

---

## 📚 十一、参考资料

### 安全标准

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- CWE/SANS Top 25: https://cwe.mitre.org/top25/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework

### 安全工具

- npm audit: 依赖安全扫描
- Snyk: 依赖漏洞检测
- SonarQube: 代码安全分析
- OWASP ZAP: Web 应用安全扫描

### 最佳实践

- NestJS Security: https://docs.nestjs.com/security
- Next.js Security: https://nextjs.org/docs/app/building-your-application/configuring/security
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

## 📞 十二、联系信息

如有安全问题或建议，请联系：

- 安全团队: security@inffinancems.com
- 技术支持: support@inffinancems.com

---

**报告生成时间**: 2026-03-21  
**下次审查日期**: 2026-06-21（建议每季度审查一次）
