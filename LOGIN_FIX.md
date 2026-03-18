# 登录问题修复说明

## 问题描述
用户反馈无法登录到 http://localhost:3000/dashboard

## 问题原因
1. **密码复杂度验证不匹配**：后端要求密码必须包含大小写字母、数字和特殊字符，但种子数据中的测试密码过于简单（如 `admin123`），不符合复杂度要求
2. **前端验证规则不一致**：前端只要求密码长度不少于6位，与后端要求不一致
3. **种子数据未更新**：数据库中的用户密码仍然是旧密码，需要重新运行种子数据脚本

## 修复内容

### 1. 更新种子数据密码
将所有测试账号的密码更新为符合复杂度要求的格式：

| 角色 | 邮箱 | 新密码 |
|------|------|--------|
| 管理员 | admin@inffinancems.com | Admin@123 |
| 财务 | finance@inffinancems.com | Finance@123 |
| 管理层 | manager@inffinancems.com | Manager@123 |
| 员工 | employee@inffinancems.com | Employee@123 |

### 2. 更新前端验证规则
将登录页面的密码最小长度要求从6位改为8位，与后端保持一致

### 3. 修复种子数据脚本
修改 `prisma/seed.ts` 文件，在 `upsert` 操作中添加 `update: { password: newPassword }`，确保每次运行种子数据时都会更新密码

### 4. 重新初始化数据库
已执行种子数据脚本，更新数据库中的用户密码

### 5. 启动服务
- API服务已在后台启动：http://localhost:3001
- Web服务已在后台启动：http://localhost:3000

## 测试步骤

### 1. 确认服务运行状态
确保以下服务正在运行：
- API服务：http://localhost:3001
- Web服务：http://localhost:3000

### 2. 测试登录
1. 访问 http://localhost:3000/login
2. 使用以下任一测试账号登录：
   - 管理员：admin@inffinancems.com / Admin@123
   - 财务：finance@inffinancems.com / Finance@123
   - 管理层：manager@inffinancems.com / Manager@123
   - 员工：employee@inffinancems.com / Employee@123
3. 登录成功后应自动跳转到 http://localhost:3000/dashboard

### 3. 验证功能
- 登录成功后能正常访问仪表板
- 能正常退出登录
- 不同角色的用户能看到相应的权限内容

## 密码复杂度规则
后端要求的密码复杂度规则：
- 最少8位字符
- 必须包含大写字母
- 必须包含小写字母
- 必须包含数字
- 必须包含特殊字符

## 技术细节

### 密码验证测试
通过测试脚本验证：
- 旧密码 `admin123`：❌ 错误
- 新密码 `Admin@123`：✅ 正确

### 种子数据更新
修改了 `packages/database/prisma/seed.ts` 文件，将所有用户的 `upsert` 操作从：
```typescript
update: {},
```
改为：
```typescript
update: { password: newPassword },
```

这样确保每次运行种子数据时都会更新密码，而不是跳过已存在的用户。

## 诊断工具

### 测试登录页面
已创建专门的测试页面来诊断登录问题：
- 访问：http://localhost:3000/test-login
- 功能：
  - 测试登录API
  - 检查Cookie设置
  - 验证Token存储
  - 自动跳转到dashboard

### API测试
使用curl测试登录API：
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@inffinancems.com","password":"Admin@123"}'
```

预期返回：
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cmkpagbja0000yxjo1y7j0wyd",
    "email": "admin@inffinancems.com",
    "name": "系统管理员",
    "role": "ADMIN"
  }
}
```

## 注意事项
- 如果仍然无法登录，请检查浏览器控制台是否有错误信息
- 确认API服务是否正常运行（访问 http://localhost:3001/api/docs）
- 确认数据库连接是否正常
- 如需重新初始化密码，运行：`cd packages/database && npm run seed`
- 使用测试页面 http://localhost:3000/test-login 进行详细诊断
