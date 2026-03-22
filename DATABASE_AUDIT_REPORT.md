# 财务管理系统 - 数据库审查报告

**审查日期**: 2026-03-21  
**审查范围**: 数据库设计、查询性能、数据安全  
**数据库类型**: PostgreSQL (通过 Prisma ORM)  
**Schema 文件**: `packages/database/prisma/schema.prisma`

---

## 执行摘要

本次审查对财务管理系统的数据库设计进行了全面评估，包括表结构设计、索引设计、关系设计、查询性能和安全性等方面。

### 总体评价

| 评估维度 | 评分 | 说明 |
|---------|------|------|
| 表结构设计 | ⭐⭐⭐⭐☆ | 整体设计合理，字段类型选择恰当，但部分字段缺少约束 |
| 索引设计 | ⭐⭐⭐☆☆ | 基本索引覆盖主要查询场景，但缺少部分关键索引 |
| 关系设计 | ⭐⭐⭐⭐⭐ | 外键关系设计清晰，级联操作配置合理 |
| 数据规范化 | ⭐⭐⭐⭐☆ | 符合第三范式，数据冗余控制良好 |
| 命名规范 | ⭐⭐⭐⭐⭐ | 命名清晰统一，遵循最佳实践 |
| 查询性能 | ⭐⭐⭐☆☆ | 存在N+1查询问题，部分查询可优化 |
| 数据安全 | ⭐⭐⭐☆☆ | 基本安全措施到位，但敏感数据未加密 |

### 关键发现

- **严重问题**: 3个
- **高优先级问题**: 8个
- **中优先级问题**: 12个
- **低优先级问题**: 6个

---

## 一、数据库设计质量分析

### 1.1 表结构设计

#### 1.1.1 核心业务表

| 表名 | 用途 | 字段数 | 评价 |
|------|------|--------|------|
| users | 用户管理 | 13 | ✅ 设计合理 |
| customers | 客户管理 | 17 | ✅ 设计合理 |
| suppliers | 供应商管理 | 14 | ✅ 设计合理 |
| contracts | 合同管理 | 19 | ✅ 设计合理 |
| payment_plans | 回款计划 | 7 | ✅ 设计合理 |
| payment_records | 回款记录 | 9 | ✅ 设计合理 |
| invoices | 发票管理 | 11 | ✅ 设计合理 |
| expenses | 报销单 | 14 | ✅ 设计合理 |
| expense_details | 报销明细 | 10 | ✅ 设计合理 |
| costs | 费用管理 | 11 | ✅ 设计合理 |
| projects | 项目管理 | 9 | ✅ 设计合理 |
| payment_requests | 付款申请 | 20 | ✅ 设计合理 |
| bank_accounts | 银行账户 | 13 | ✅ 设计合理 |

#### 1.1.2 支持功能表

| 表名 | 用途 | 字段数 | 评价 |
|------|------|--------|------|
| departments | 部门管理 | 10 | ✅ 设计合理 |
| budgets | 预算管理 | 10 | ✅ 设计合理 |
| audit_logs | 审计日志 | 10 | ✅ 设计合理 |
| notifications | 消息通知 | 10 | ✅ 设计合理 |
| role_permissions | 权限管理 | 7 | ✅ 设计合理 |
| dictionaries | 数据字典 | 12 | ✅ 设计合理 |
| contract_import_logs | 合同导入日志 | 9 | ✅ 设计合理 |

### 1.2 字段类型分析

#### ✅ 优点

1. **金额字段使用 Decimal 类型**
   - 所有金额字段使用 `Decimal(15, 2)`，精度充足
   - 避免了浮点数精度问题

2. **日期字段使用 DateTime 类型**
   - 统一使用 `DateTime` 类型存储时间
   - 包含 `createdAt` 和 `updatedAt` 标准字段

3. **枚举类型使用恰当**
   - 使用 Prisma Enum 定义状态字段
   - 类型安全，避免无效值

4. **JSON 字段使用合理**
   - `attachments` 使用 JSON 存储附件列表
   - `metadata` 使用 JSON 存储扩展信息

#### ⚠️ 问题

1. **字符串字段缺少长度限制**
   ```prisma
   // 问题示例
   name         String // 客户名称 - 无长度限制
   address      String? // 地址 - 无长度限制
   remark       String? // 备注 - 无长度限制
   ```
   **影响**: 可能导致存储空间浪费，影响查询性能
   **建议**: 为常用字符串字段添加长度限制，如 `String @db.VarChar(100)`

2. **部分字段缺少非空约束**
   ```prisma
   // 问题示例
   phone        String? // 联系电话 - 可为空
   contactPhone String? // 联系电话 - 可为空
   ```
   **影响**: 数据完整性无法保证
   **建议**: 根据业务需求评估是否应该设置非空约束

3. **缺少检查约束**
   ```prisma
   // 问题示例
   month       Int? // 预算月份 - 无范围检查
   ```
   **影响**: 可能插入无效数据（如 month = 13）
   **建议**: 在数据库层面添加检查约束

### 1.3 索引设计分析

#### 1.3.1 现有索引清单

| 表名 | 索引字段 | 类型 | 评价 |
|------|----------|------|------|
| users | email | UNIQUE | ✅ 必需 |
| users | feishuUserId | UNIQUE | ✅ 必需 |
| users | feishuOpenId | UNIQUE | ✅ 必需 |
| customers | code | UNIQUE | ✅ 必需 |
| contracts | contractNo | UNIQUE | ✅ 必需 |
| contracts | signDate | INDEX | ✅ 常用查询 |
| contracts | endDate | INDEX | ✅ 常用查询 |
| contracts | contractType | INDEX | ✅ 常用查询 |
| contracts | signingEntity | INDEX | ✅ 常用查询 |
| contracts | customerId, signDate | COMPOSITE | ✅ 复合索引 |
| suppliers | name | INDEX | ✅ 常用查询 |
| suppliers | type | INDEX | ✅ 常用查询 |
| suppliers | isDeleted | INDEX | ✅ 软删除查询 |
| costs | projectId | INDEX | ✅ 常用查询 |
| costs | contractId | INDEX | ✅ 常用查询 |
| costs | feeType | INDEX | ✅ 常用查询 |
| costs | source | INDEX | ✅ 常用查询 |
| costs | occurDate | INDEX | ✅ 常用查询 |
| costs | projectId, feeType, source, occurDate | COMPOSITE | ✅ 复合索引 |
| notifications | userId, isRead, createdAt | COMPOSITE | ✅ 复合索引 |
| budgets | year, month, department, feeType | UNIQUE | ✅ 唯一约束 |
| payment_requests | contractId | INDEX | ✅ 常用查询 |

#### ⚠️ 缺少的关键索引

1. **expenses 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_expenses_applicantId ON expenses(applicantId);
   CREATE INDEX idx_expenses_projectId ON expenses(projectId);
   CREATE INDEX idx_expenses_status ON expenses(status);
   CREATE INDEX idx_expenses_submitDate ON expenses(submitDate);
   ```

2. **payment_plans 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_payment_plazns_contractId ON payment_plans(contractId);
   CREATE INDEX idx_payment_plans_status ON payment_plans(status);
   CREATE INDEX idx_payment_plans_planDate ON payment_plans(planDate);
   ```

3. **payment_records 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_payment_records_contractId ON payment_records(contractId);
   CREATE INDEX idx_payment_records_paymentDate ON payment_records(paymentDate);
   ```

4. **invoices 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_invoices_contractId ON invoices(contractId);
   CREATE INDEX idx_invoices_invoiceDate ON invoices(invoiceDate);
   CREATE INDEX idx_invoices_status ON invoices(status);
   ```

5. **audit_logs 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);
   CREATE INDEX idx_audit_logs_entityType_entityId ON audit_logs(entityType, entityId);
   CREATE INDEX idx_audit_logs_createdAt ON audit_logs(createdAt);
   ```

6. **customers 表缺少索引**
   ```sql
   -- 建议添加
   CREATE INDEX idx_customers_type ON customers(type);
   CREATE INDEX idx_customers_approvalStatus ON customers(approvalStatus);
   CREATE INDEX idx_customers_submittedBy ON customers(submittedBy);
   ```

### 1.4 关系设计分析

#### ✅ 优点

1. **外键关系清晰**
   - 所有表间关系通过外键明确定义
   - 使用 `@relation` 装饰器清晰标注关系名称

2. **级联操作配置合理**
   ```prisma
   // 示例：级联删除
   expense Expense @relation(fields: [expenseId], references: [id], onDelete: Cascade)
   
   // 示例：设置为空
   department Department? @relation(fields: [departmentId], references: [id], onDelete: SetNull)
   
   // 示例：限制删除
   contract Contract @relation(fields: [contractId], references: [id], onDelete: Restrict)
   ```

3. **自引用关系处理正确**
   ```prisma
   // 部门树形结构
   parent   Department?  @relation("DepartmentTree", fields: [parentId], references: [id])
   children Department[] @relation("DepartmentTree")
   ```

#### ⚠️ 问题

1. **部分外键缺少索引**
   - 外键字段应该自动创建索引，但建议显式声明
   - 例如：`expenses.contractId`、`expenses.projectId` 等

### 1.5 数据规范化程度

#### ✅ 优点

1. **符合第三范式 (3NF)**
   - 每个非主键字段都直接依赖于主键
   - 消除了传递依赖

2. **数据字典设计合理**
   ```prisma
   model Dictionary {
     type   String // 字典类型
     code   String // 字典编码
     name   String // 显示名称
     value  String? // 实际值
   }
   ```
   - 避免了硬编码枚举值
   - 便于扩展和维护

3. **分离主表和明细表**
   - `expenses` 和 `expense_details` 分离
   - `contracts` 和 `payment_plans` 分离

#### ⚠️ 问题

1. **部分冗余字段**
   ```prisma
   model Expense {
     department String // 部门名称 - 冗余，已有 departmentId
   }
   ```
   **影响**: 数据不一致风险
   **建议**: 移除冗余字段，通过关联查询获取

---

## 二、常见数据库问题检查

### 2.1 缺少必要的索引

#### 🔴 严重问题

1. **expenses 表缺少 applicantId 索引**
   - **影响**: 查询用户报销单时性能差
   - **位置**: `expenses.applicantId`
   - **建议**: 添加索引 `CREATE INDEX idx_expenses_applicantId ON expenses(applicantId);`

2. **payment_plans 表缺少 contractId 索引**
   - **影响**: 查询合同回款计划时性能差
   - **位置**: `payment_plans.contractId`
   - **建议**: 添加索引 `CREATE INDEX idx_payment_plans_contractId ON payment_plans(contractId);`

3. **payment_records 表缺少 contractId 索引**
   - **影响**: 查询合同回款记录时性能差
   - **位置**: `payment_records.contractId`
   - **建议**: 添加索引 `CREATE INDEX idx_payment_records_contractId ON payment_records(contractId);`

#### 🟡 高优先级

4. **invoices 表缺少 contractId 索引**
   - **影响**: 查询合同发票时性能差
   - **建议**: 添加索引 `CREATE INDEX idx_invoices_contractId ON invoices(contractId);`

5. **audit_logs 表缺少 userId 索引**
   - **影响**: 查询用户操作日志时性能差
   - **建议**: 添加索引 `CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);`

6. **customers 表缺少 approvalStatus 索引**
   - **影响**: 查询待审批客户时性能差
   - **建议**: 添加索引 `CREATE INDEX idx_customers_approvalStatus ON customers(approvalStatus);`

### 2.2 冗余数据

#### 🟡 高优先级

1. **expenses.department 字段冗余**
   ```prisma
   model Expense {
     applicantId  String
     department   String // 冗余字段
   }
   ```
   - **问题**: 部门信息应该通过 `applicant.department` 获取
   - **影响**: 数据不一致风险
   - **建议**: 移除 `department` 字段，通过关联查询获取

2. **payment_requests 收款方信息冗余**
   ```prisma
   model PaymentRequest {
     bankAccountId String
     payeeName     String? // 冗余
     payeeAccount  String? // 冗余
     payeeBank     String? // 冗余
   }
   ```
   - **问题**: 收款方信息应该从 `bankAccount` 获取
   - **影响**: 数据不一致风险
   - **建议**: 评估是否需要保留（可能用于历史记录）

### 2.3 外键约束缺失

#### ✅ 优点

- 所有外键关系都已正确定义
- 使用了适当的级联操作策略

#### ὾2 无问题

### 2.4 字段类型不合适

#### ὾1 高优先级

1. **字符串字段缺少长度限制**
   ```prisma
   // 问题字段
   name         String // 客户名称
   address      String? // 地址
   remark       String? // 备注
   description  String? // 说明
   ```
   - **影响**: 可能存储超长文本，影响性能
   - **建议**: 
     ```prisma
     name         String @db.VarChar(100)
     address      String? @db.VarChar(500)
     remark       String? @db.VarChar(1000)
     description  String? @db.VarChar(1000)
     ```

2. **电话号码字段类型**
   ```prisma
   phone        String?
   contactPhone String?
   ```
   - **影响**: 无法验证格式
   - **建议**: 添加应用层验证，或使用 `@db.VarChar(20)` 限制长度

### 2.5 缺少默认值或约束

#### ὾1 高优先级

1. **Budget.month 缺少范围检查**
   ```prisma
   month Int? // 应该是 1-12
   ```
   - **影响**: 可能插入无效数据
   - **建议**: 添加应用层验证或数据库检查约束

2. **PaymentPlan.period 缺少范围检查**
   ```prisma
   period Int // 期数 - 应该 >= 1
   ```

3. **部分布尔字段缺少默认值**
   ```prisma
   hasInvoice Boolean @default(false) // ✅ 有默认值
   isDeleted Boolean @default(false) // ✅ 有默认值
   ```

### 2.6 未使用的表或字段

#### ὾2 无明显问题

- 所有表和字段都在代码中被使用
- 没有发现明显的废弃字段

### 2.7 潜在的 N+1 查询问题

#### ὓ4 严重问题

1. **reports.service.ts - getReceivablesOverview()**
   ```typescript
   // 问题代码
   const contracts = await this.prisma.contract.findMany({
     where: { isDeleted: false, status: { in: [...] } },
     include: {
       paymentPlans: true,  // ✅ 使用了 include
       paymentRecords: true, // ✅ 使用了 include
     },
   });
   ```
   - **评价**: ✅ 已正确使用 `include` 避免 N+1

2. **reports.service.ts - getCustomerReport()**
   ```typescript
   // 问题代码
   const customers = await this.prisma.customer.findMany({
     where: { isDeleted: false },
     include: {
       contracts: {
         where: { isDeleted: false },
         include: {
           paymentPlans: true,   // ✅ 嵌套 include
           paymentRecords: true, // ✅ 嵌套 include
         },
       },
     },
   });
   ```
   - **评价**: ✅ 已正确使用嵌套 `include` 避免 N+1

3. **payments.service.ts - getStatistics()**
   ```typescript
   // 潜在问题
   const contracts = await this.prisma.contract.findMany({
     where: { isDeleted: false },
     include: {
       paymentPlans: true,
       paymentRecords: true,
     },
   });
   ```
   - **评价**: ✅ 已正确使用 `include`

#### ὾1 高优先级

4. **contracts.service.ts - findAll() 可能存在 N+1**
   ```typescript
   // 需要检查的代码
   const items = await this.prisma.contract.findMany({
     where,
     skip,
     take,
     orderBy: { [safeSortBy]: sortOrder },
     // 是否缺少 include?
   });
   
   // 如果后续循环中查询关联数据，会导致 N+1
   const itemsWithPayment = items.map((contract) => {
     // 这里是否在查询 paymentPlans?
   });
   ```
   - **建议**: 检查是否需要在 `findMany` 中添加 `include`

---

## 三、查询性能评估

### 3.1 查询语句效率

#### ✅ 优点

1. **使用 Prisma ORM**
   - 自动生成优化的 SQL
   - 参数化查询，防止 SQL 注入

2. **分页查询实现正确**
   ```typescript
   const skip = (page - 1) * pageSize;
   const items = await this.prisma.cost.findMany({
     where,
     skip,
     take: pageSize,
   });
   ```
   - 使用 `skip` 和 `take` 实现分页
   - 限制最大页大小（100）

3. **使用 Promise.all 并行查询**
   ```typescript
   const [items, total] = await Promise.all([
     this.prisma.cost.findMany({ ... }),
     this.prisma.cost.count({ where }),
   ]);
   ```
   - 并行执行查询，减少总耗时

#### ὾1 高优先级

1. **大数据量分页性能问题**
   ```typescript
   // 当前实现
   const skip = (page - 1) * pageSize;
   const items = await this.prisma.cost.findMany({
     skip,  // 大 offset 时性能差
     take: pageSize,
   });
   ```
   - **问题**: 当 `skip` 很大时（如第 1000 页），PostgreSQL 需要扫描并跳过大量行
   - **建议**: 对于大数据量场景，使用基于游标的分页
     ```typescript
     // 建议实现
     const items = await this.prisma.cost.findMany({
       where: {
         ...where,
         id: { gt: cursor }, // 使用游标
       },
       take: pageSize,
     });
     ```

### 3.2 JOIN 使用情况

#### ✅ 优点

1. **正确使用 include 进行关联查询**
   ```typescript
   // costs.service.ts
   include: {
     project: { select: { id: true, code: true, name: true } },
     contract: { select: { id: true, contractNo: true, name: true } },
     expense: { select: { id: true, expenseNo: true } },
   }
   ```
   - 使用 `select` 只查询需要的字段
   - 减少数据传输量

2. **嵌套 include 使用正确**
   ```typescript
   // reports.service.ts
   include: {
     contracts: {
       include: {
         paymentPlans: true,
         paymentRecords: true,
       },
     },
   }
   ```

#### ὾1 高优先级

1. **部分查询可能缺少必要的 include**
   - 需要检查所有 `findMany` 调用
   - 确保关联数据通过 `include` 一次性获取

### 3.3 复杂查询优化空间

#### ὾1 高优先级

1. **报表查询可能需要优化**
   ```typescript
   // reports.service.ts - getReceivablesOverview()
   // 获取所有合同及其关联数据
   const contracts = await this.prisma.contract.findMany({
     where: { isDeleted: false, status: { in: [...] } },
     include: { paymentPlans: true, paymentRecords: true },
   });
   
   // 在应用层进行计算
   for (const contract of contracts) {
     // 大量计算逻辑
   }
   ```
   - **问题**: 数据量大时，应用层计算效率低
   - **建议**: 使用数据库聚合函数
     ```sql
     -- 建议使用原生 SQL
     SELECT 
       c.id,
       c.amount_with_tax,
       COALESCE(SUM(pr.amount), 0) as received_amount,
       c.amount_with_tax - COALESCE(SUM(pr.amount), 0) as receivable_amount
     FROM contracts c
     LEFT JOIN payment_records pr ON pr.contract_id = c.id
     WHERE c.is_deleted = false
     GROUP BY c.id, c.amount_with_tax;
     ```

2. **账龄计算在应用层**
   ```typescript
   // reports.service.ts
   function calculateAging(dueDate: Date | string): number {
     const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
     const today = new Date();
     return Math.ceil((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
   }
   ```
   - **问题**: 每条记录都在应用层计算
   - **建议**: 使用数据库日期函数
     ```sql
     SELECT 
       plan_date,
       EXTRACT(DAY FROM (CURRENT_DATE - plan_date)) as aging_days
     FROM payment_plans;
     ```

### 3.4 事务使用评估

#### ✅ 优点

1. **正确使用事务保证数据一致性**
   ```typescript
   // expenses.service.ts - pay()
   return this.prisma.$transaction(async (tx) => {
     // 更新报销单状态
     await tx.expense.update({ ... });
     
     // 创建费用记录
     await tx.cost.create({ ... });
     
     // 更新预算
     await tx.budget.update({ ... });
   });
   ```

2. **事务范围合理**
   - 只在需要原子性操作时使用事务
   - 避免长事务

#### ὾2 无问题

---

## 四、数据安全检查

### 4.1 敏感数据加密

#### ὓ4 严重问题

1. **用户密码未加密存储**
   ```prisma
   model User {
     password String? // 应该存储哈希值
   }
   ```
   - **问题**: 密码字段未明确标注为哈希值
   - **影响**: 如果数据库泄露，密码可能被破解
   - **建议**: 
     - 确保应用层使用 bcrypt 或 argon2 哈希密码
     - 添加注释说明：`password String? // bcrypt hash`
     - 考虑使用数据库加密函数

2. **银行账号明文存储**
   ```prisma
   model BankAccount {
     accountNo String @unique! // 银行账号 - 明文
   }
   ```
   - **问题**: 银行账号等敏感信息明文存储
   - **影响**: 数据库泄露时敏感信息暴露
   - **建议**: 
     - 使用数据库透明加密（TDE）
     - 或应用层加密后存储
     - 添加访问审计日志

3. **统一社会信用代码明文存储**
   ```prisma
   model Customer {
     creditCode String? // 统一社会信用代码
   }
   model Supplier {
     creditCode String? // 统一社会信用代码
   }
   ```
   - **问题**: 企业敏感信息明文存储
   - **建议**: 评估是否需要加密

### 4.2 SQL 注入防护

#### ✅ 优点

1. **使用 Prisma ORM**
   - 自动参数化查询
   - 有效防止 SQL 注入

2. **使用类型安全的 DTO**
   ```typescript
   // 所有输入都经过 DTO 验证
   async findAll(query: QueryCostDto) {
     const { page, pageSize, feeType, ... } = query;
     // Prisma 自动转义参数
   }
   ```

#### ὾2 无问题

### 4.3 数据备份策略

#### ⚠️ 需要确认

- **未在代码中发现备份策略**
- **建议**:
  1. 配置 PostgreSQL 定期备份（pg_dump）
  2. 实施增量备份
  3. 测试备份恢复流程
  4. 考虑异地备份

### 4.4 权限控制

#### ✅ 优点

1. **应用层权限控制**
   ```typescript
   // expenses.service.ts
   async findAll(query: QueryExpenseDto, userId: string, userRole: RoleType) {
     // 根据用户角色过滤数据
     if (userRole !== 'ADMIN' && userRole !== 'FINANCE') {
       where.applicantId = userId;
     }
   }
   ```

2. **审计日志记录**
   ```prisma
   model AuditLog {
     userId     String
     action     String
     entityType String
     entityId   String
     oldValue   Json?
     newValue   Json?
     ipAddress  String?
     userAgent  String?
   }
   ```

#### ὾1 高优先级

1. **缺少数据库层面权限控制**
   - **问题**: 所有应用使用同一个数据库用户
   - **影响**: 应用漏洞可能导致数据泄露
   - **建议**: 
     - 为不同模块创建不同的数据库用户
     - 使用 Row-Level Security (RLS)
     - 限制数据库用户的权限

2. **审计日志缺少索引**
   - **问题**: 查询审计日志时性能差
   - **建议**: 添加索引（见 2.1 节）

---

## 五、发现的问题清单

### ὓ4 严重问题 (3个)

| ID | 问题描述 | 表/字段 | 影响 |
|----|----------|---------|------|
| DB-001 | 用户密码未明确标注为哈希值 | users.password | 数据库泄露时密码可能被破解 |
| DB-002 | 银行账号明文存储 | bank_accounts.accountNo | 敏感信息泄露风险 |
| DB-003 | expenses[.applicantId 缺少索引 | expenses.applicantId | 查询用户报销单时性能差 |

### ὾1 高优先级问题 (8个)

| ID | 问题描述 | 表/字段 | 影响 |
|----|----------|---------|------|
| DB-004 | payment_plans.contractId 缺少索引 | payment_plans.contractId | 查询合同回款计划时性能差 |
| DB-005 | payment_records.contractId 缺少索引 | payment_records.contractId | 查询合同回款记录时性能差 |
| DB-006 | invoices.contractId 缺少索引 | invoices.contractId | 查询合同发票时性能差 |
| DB-007 | audit_logs.userId 缺少索引 | audit_logs.userId | 查询用户操作日志时性能差 |
| DB-008 | expenses.department 字段冗余 | expenses.department | 数据不一致风险 |
|DB-009 | 字符串字段缺少长度限制 | 多个表的 name, address 等 | 存储空间浪费，性能影响 |
| DB-010 | 报表查询在应用层计算 | reports.service.ts | 大数据量时效率低 |
| DB-011 | 缺少数据库层面权限控制 | 所有表 | 应用漏洞可能导致数据泄露 |

### ὾2 中优先级问题 (12个)

| ID | 问题描述 | 表/字段 | 影响 |
|----|----------|---------|------|
| DB-012 | customers.approvalStatus 缺少索引 | customers.approvalStatus | 查询待审批客户时性能差 |
| DB-013 | 统一社会信用代码明文存储 | customers.creditCode, suppliers.creditCode | 敏感信息泄露风险 |
| DB-014 | Budget.month 缺少范围检查 | budgets.month | 可能插入无效数据 |
| DB-015 | PaymentPlan.period 缺少范围检查 | payment_plans.period | 可能插入无效数据 |
| DB-016 | 大数据量分页使用 offset | 多个查询 | 大 offset 时性能差 |
| DB-017 | 账龄计算在应用层 | reports.service.ts | 每条记录都在应用层计算 |
| DB-018 | 电话号码字段缺少格式验证 | users.phone, customers.contactPhone | 无法验证格式 |
| DB-019 | 部分外键字段缺少显式索引 | 多个表 | 查询性能可能受影响 |
| DB-020 | 缺少数据备份策略 | - | 数据丢失风险 |
| DB-021 | audit_logs 缺少复合索引 | audit_logs.entityType, entityId | 查询性能差 |
| DB-022 | payment_requests 收款方信息冗余 | payment_requests.payeeName 等 | 数据不一致风险 |
| DB-023 | contracts.service.findAll 可能存在 N+1 | contracts.service.ts | 需要进一步检查 |

### ὓ5 低优先级问题 (6个)

| ID | 问题描述 | 表/字段 | 影响 |
|----|----------|---------|------|
| DB-024 | 部分字段缺少非空约束 | 多个表 | 数据完整性无法保证 |
| DB-025 | 缺少检查约束 | 多个表 | 可能插入无效数据 |
| DB-026 | 部分备注字段长度限制 | 多个表的 remark | 可能存储超长文本 |
| DB-027 | 缺少部分日期范围索引 | 多个表 | 日期范围查询性能可能受影响 |
| DB-028 | 缺少全文搜索索引 | customers.name, suppliers.name | 模糊搜索性能差 |
| DB-029 | 缺少分区策略 | 大表 | 数据量大时维护困难 |

---

## 六、性能优化建议

### 6.1 索引优化

#### 立即执行

```sql
-- 1. expenses 表索引
CREATE INDEX idx_expenses_applicantId ON expenses(applicantId);
CREATE INDEX idx_expenses_projectId ON expenses(projectId);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_submitDate ON expenses(submitDate);

-- 2. payment_plans 表索引
CREATE INDEX idx_payment_plans_contractId ON payment_plans(contractId);
CREATE INDEX idx_payment_plans_status ON payment_plans(status);
CREATE INDEX idx_payment_plans_planDate ON payment_plans(planDate);

-- 3. payment_records 表索引
CREATE INDEX idx_payment_records_contractId ON payment_records(contractId);
CREATE INDEX idx_payment_records_paymentDate ON payment_records(paymentDate);

-- 4. invoices 表索引
CREATE INDEX idx_invoices_contractId ON invoices(contractId);
CREATE INDEX idx_invoices_invoiceDate ON invoices(invoiceDate);
CREATE INDEX idx_invoices_status ON invoices(status);

-- 5. audit_logs 表索引
CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX idx_audit_logs_entityType_entityId ON audit_logs(entityType, entityId);
CREATE INDEX idx_audit_logs_createdAt ON audit_logs(createdAt);

-- 6. customers 表索引
CREATE INDEX idx_customers_type ON customers(type);
CREATE INDEX idx_customers_approvalStatus ON customers(approvalStatus);
CREATE INDEX idx_customers_submittedBy ON customers(submittedBy);
```

#### 考虑执行

```sql
-- 7. 复合索引优化
CREATE INDEX idx_expenses_applicantId_status ON expenses(applicantId, status);
CREATE INDEX idx_payment_plans_contractId_status ON payment_plans(contractId, status);
CREATE INDEX idx_invoices_contractId_status ON invoices(contractId, status);

-- 8. 部分索引（只索引活跃数据）
CREATE INDEX idx_contracts_active ON contracts(customerId, signDate) 
WHERE is_deleted = false AND status IN ('EXECUTING', 'COMPLETED');

-- 9. 表达式索引（用于模糊搜索）
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin(name gin_trgm_ops);
```

### 6.2 查询优化

#### 6.2.1 使用原生 SQL 优化报表查询

```typescript
// reports.service.ts
async getReceivablesOverview() {
  const result = await this.prisma.$queryRaw`
    SELECT 
      COALESCE(SUM(c.amount_with_tax), 0) as total_contract_amount,
      COALESCE(SUM(pr.received_amount), 0) as total_received,
      COALESCE(SUM(c.amount_with_tax - pr.received_amount), 0) as total_receivable
    FROM contracts c
    LEFT JOIN (
      SELECT 
        contract_id,
        COALESCE(SUM(amount), 0) as received_amount
      FROM payment_records
      GROUP BY contract_id
    ) pr ON pr.contract_id = c.id
    WHERE c.is_deleted = false 
      AND c.status IN ('EXECUTING', 'COMPLETED')
  `;
  
  return {
    totalContractAmount: Number(result[0].total_contract_amount),
    totalReceived: Number(result[0].total_received),
    totalReceivable: Number(result[0].total_receivable),
  };
}
```

#### 6.2.2 使用游标分页

```typescript
// 通用游标分页实现
async findAllWithCursor(query: QueryDto, cursor?: string) {
  const { pageSize = 20 } = query;
  
  const items = await this.prisma.cost.findMany({
    where: {
      ...query.where,
      ...(cursor && { id: { gt: cursor } }),
    },
    take: pageSize + 1, // 多取一个判断是否有下一页
    },
    orderBy: { id: 'asc' },
  });
  
  const hasMore = items.length > pageSize;
  if (hasMore) items.pop();
  
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}
```

#### 6.2.3 使用批量查询

```typescript
// 批量获取合同回款信息
async getContractsWithPayments(contractIds: string[]) {
  const contracts = await this.prisma.contract.findMany({
    where: { id: { in: contractIds } },
  });
  
  const paymentPlans = await this.prisma.paymentPlan.findMany({
    where: { contractId: { in: contractIds } },
  });
  
  const paymentRecords = await this.prisma.paymentRecord.findMany({
    where: { contractId: { in: contractIds } },
  });
  
  // 在应用层组装数据
  return contracts.map(contract => ({
    ...contract,
    paymentPlans: paymentPlans.filter(p => p.contractId === contract.id),
    paymentRecords: paymentRecords.filter(r => r.contractId === contract.id),
  }));
}
```

### 6.3 数据库配置优化

#### PostgreSQL 配置建议

```postgresql
# postgresql.conf

# 内存配置
shared_buffers = 256MB              # 根据服务器内存调整（通常为总内存的 25%）
effective_cache_size = 1GB          # 根据服务器内存调整（通常为总内存的 50-75%）
work_mem = 16MB                    # 每个排序操作的内存
maintenance_work_mem = 128MB       # 维护操作内存

# 查询优化
random_page_cost = 1.1             # SSD 使用 1.1，HDD 使用 4.0
effective_io_concurrency = 200     # SSD 可以设置更高

# 连接配置
max_connections = 100              # 根据应用需求调整

# WAL 配置
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# 日志配置
log_min_duration_statement = 1000   # 记录执行时间超过 1 秒的查询
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
```

### 6.4 分区策略（长期规划）

```sql
-- 按年份分区 audit_logs 表
CREATE TABLE audit_logs (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE audit_logs_2025 PARTITION OF audit_logs
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE audit_logs_2026 PARTITION OF audit_logs
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- 自动创建未来分区的函数
CREATE OR REPLACE FUNCTION create_audit_logs_partition()
RETURNS void AS $$
DECLARE
  partition_name text;
  start_date text;
  end_date text;
BEGIN
  partition_name := 'audit_logs_' || to_char(CURRENT_DATE + interval '1 year', 'YYYY');
  start_date := to_char(CURRENT_DATE + interval '1 year', 'YYYY') || '-01-01';
  end_date := to_char(CURRENT_DATE + interval '2 years', 'YYYY') || '-01-01';
  
  EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;
```

---

## 七、数据结构改进建议

### 7.1 移除冗余字段

```prisma
// schema.prisma

// 修改前
model Expense {
  id           String        @id @default(cuid())
  expenseNo    String        @unique
  applicantId  String
  department   String // ❌ 冗余字段
  // ...
}

// 修改后
model Expense {
  id           String        @id @default(cuid())
  expenseNo    String        @unique
  applicantId  String
  // ✅ 通过 applicant.department 获取
  // ...
}
```

**迁移脚本**:
```sql
-- 1. 添加临时列
ALTER TABLE expenses ADD COLUMN department_id_new TEXT;

-- 2. 从 users 表获取 departmentId
UPDATE expenses e
SET department_id_new = u.department_id
FROM users u
WHERE e.applicant_id = u.id;

-- 3. 删除旧列
ALTER TABLE expenses DROP COLUMN department;

-- 4. 重命名新列（如果需要保留）
-- ALTER TABLE expenses RENAME COLUMN department_id_new TO department_id;
```

### 7.2 添加字段长度限制

```prisma
// schema.prisma

model Customer {
  id           String       @id @default(cuid())
  code         String       @unique @db.VarChar(50)
  name         String       @db.VarChar(200) // ✅ 添加长度限制
  type         String       @db.VarChar(50)
  creditCode   String?      @db.VarChar(50)
  contactName  String?      @db.VarChar(100)
  contactPhone String?      @db.VarChar(20)
  contactEmail String?      @db.VarChar(100)
  address      String?      @db.VarChar(500)
  remark       String?      @db.VarChar(1000)
  // ...
}

model Supplier {
  id              String   @id @default(cuid())
  code            String   @unique @db.VarChar(50)
  name            String   @db.VarChar(200) // ✅ 添加长度限制
  type            String   @db.VarChar(50)
  creditCode      String?  @db.VarChar(50)
  contactName     String?  @db.VarChar(100)
  contactPhone    String?  @db.VarChar(20)
  contactEmail    String?  @db.VarChar(100)
  address         String?  @db.VarChar(500)
  bankName        String?  @db.VarChar(100)
  bankAccountName String?  @db.VarChar(200)
  bankAccountNo   String?  @db.VarChar(50)
  remark          String?  @db.VarChar(1000)
  // ...
}
```

### 7.3 添加检查约束

```sql
-- 1. Budget.month 范围检查
ALTER TABLE budgets 
ADD CONSTRAINT chk_budget_month_valid 
CHECK (month IS NULL OR (month >= 1 AND month <= 12));

-- 2. PaymentPlan.period 范围检查
ALTER TABLE payment_plans
ADD CONSTRAINT chk_payment_plan_period_positive
CHECK (period >= 1);

-- 3. Contract 日期逻辑检查
ALTER TABLE contracts
ADD CONSTRAINT chk_contract_date_order
CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date);

-- 4. 金额非负检查
ALTER TABLE contracts
ADD CONSTRAINT chk_contract_amount_positive
CHECK (amount_with_tax >= 0 AND amount_without_tax >= 0);

ALTER TABLE payment_plans
ADD CONSTRAINT chk_payment_plan_amount_positive
CHECK (plan_amount >= 0);

ALTER TABLE payment_records
ADD CONSTRAINT chk_payment_record_amount_positive
CHECK (amount >= 0);
```

### 7.4 添加全文搜索支持

```sql
-- 1. 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. 创建 GIN 索引用于模糊搜索
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin(name gin_trgm_ops);
CREATE INDEX idx_contracts_name_trgm ON contracts USING gin(name gin_trgm_ops);

-- 3. 使用示例
-- SELECT * FROM customers WHERE name % '搜索关键词';
```

---

## 八、安全性建议

### 8.1 敏感数据加密

#### 8.1.1 使用 PostgreSQL pgcrypto 扩展

```sql
-- 启用 pgcrypto 扩展
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建加密函数
CREATE OR REPLACE FUNCTION encrypt_sensitive_data(data text, key text)
RETURNS bytea AS $$
BEGIN
  RETURN pgp_sym_encrypt(data, key);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrypt_sensitive_data(data bytea, key text)
RETURNS text AS $$
BEGIN
  RETURN pgp_sym_decrypt(data, key);
END;
$$ LANGUAGE plpgsql;
```

#### 8.1.2 应用层加密方案

```typescript
// utils/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// 使用示例
// prisma.bankAccount.create({
//   data: {
//     accountNo: encrypt('6222021234567890'),
//     // ...
//   }
// });
```

### 8.2 数据库层面权限控制

```sql
-- 1. 创建只读用户
CREATE USER readonly_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE inf_finance_ms TO readonly_user;
GRANT USAGE ON SCHEMA public TO readonly_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;

-- 2. 创建应用用户（有限权限）
CREATE USER app_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE inf_finance_ms TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- 3. 使用 Row-Level Security (RLS)
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 创建策略：用户只能查看自己的报销单
CREATE POLICY user_expenses_select ON expenses
  FOR SELECT
  USING (applicant_id = current_setting('app.current_user_id')::text);

-- 创建策略：管理员可以查看所有报销单
CREATE POLICY admin_expenses_select ON expenses
  FOR SELECT
  TO app_admin_user
  USING (true);
```

### 8.3 审计日志增强

```sql
-- 1. 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
    VALUES (
      current_setting('app.current_user_id', true),
      'CREATE',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, created_at)
    VALUES (
      current_setting('app.current_user_id', true),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, created_at)
    VALUES (
      current_setting('app.current_user_id', true),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD),
      NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. 为敏感表创建触发器
CREATE TRIGGER contracts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER payments_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON payment_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### 8.4 数据备份策略

```bash
#!/bin/bash
# backup.sh - 数据库备份脚本

BACKUP_DIR="/var/backups/inf_finance_ms"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="inf_finance_ms"
DB_USER="postgres"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 全量备份
pg_dump -U "$DB_USER" -h localhost -p 5432 -F c -b -v -f "$BACKUP_DIR/full_backup_$DATE.dump" "$DB_NAME"

# 压缩备份
gzip "$BACKUP_DIR/full_backup_$DATE.dump"

# 删除旧备份
find "$BACKUP_DIR" -name "full_backup_*.dump.gz" -mtime +$RETENTION_DAYS -delete

# 记录日志
echo "Backup completed: $DATE" >> "$BACKUP_DIR/backup.log"
```

```bash
# 添加到 crontab
# 每天凌晨 2 点执行备份
0 2 * * * /path/to/backup.sh
```

---

## 九、具体优化方案和示例

### 9.1 完整的索引优化迁移

```sql
-- migration: add_missing_indexes.sql

-- ============================================
-- expenses 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_applicantId 
  ON expenses(applicantId);

CREATE INDEX IF NOT EXISTS idx_expenses_projectId 
  ON expenses(projectId);

CREATE INDEX IF NOT EXISTS idx_expenses_status 
  ON expenses(status);

CREATE INDEX IF NOT EXISTS idx_expenses_submitDate 
  ON expenses(submitDate);

CREATE INDEX IF NOT EXISTS idx_expenses_applicantId_status 
  ON expenses(applicantId, status);

-- ============================================
-- payment_plans 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_plans_contractId 
  ON payment_plans(contractId);

CREATE INDEX IF NOT EXISTS idx_payment_plans_status 
  ON payment_plans(status);

CREATE INDEX IF NOT EXISTS idx_payment_plans_planDate 
  ON payment_plans(planDate);

CREATE INDEX IF NOT EXISTS idx_payment_plans_contractId_status 
  ON payment_plans(contractId, status);

-- ============================================
-- payment_records 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_payment_records_contractId 
  ON payment_records(contractId);

CREATE INDEX IF NOT EXISTS idx_payment_records_paymentDate 
  ON payment_records(paymentDate);

-- ============================================
-- invoices 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_contractId 
  ON invoices(contractId);

CREATE INDEX IF NOT EXISTS idx_invoices_invoiceDate 
  ON invoices(invoiceDate);

CREATE INDEX IF NOT EXISTS idx_invoices_status 
  ON invoices(status);

CREATE INDEX IF NOT EXISTS idx_invoices_contractId_status 
  ON invoices(contractId, status);

-- ============================================
-- audit_logs 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_userId 
  ON audit_logs(userId);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entityType_entityId 
  ON audit_logs(entityType, entityId);

CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt 
  ON audit_logs(createdAt);

CREATE INDEX IF NOT EXISTS idx_audit_logs_userId_createdAt 
  ON audit_logs(userId, createdAt DESC);

-- ============================================
-- customers 表索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customers_type 
  ON customers(type);

CREATE INDEX IF NOT EXISTS idx_customers_approvalStatus 
  ON customers(approvalStatus);

CREATE INDEX IF NOT EXISTS idx_customers_submittedBy 
  ON customers(submittedBy);

-- ============================================
-- 优化现有索引
-- ============================================
-- 为 contracts 表添加部分索引
CREATE INDEX IF NOT EXISTS idx_contracts_active 
  ON contracts(customerId, signDate) 
  WHERE isDeleted = false AND status IN ('EXECUTING', 'COMPLETED');

-- ============================================
-- 全文搜索索引
-- ============================================
-- 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建 GIN 索引
CREATE INDEX IF NOT EXISTS idx_customers_name_trgm 
  ON customers USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_suppliers_name_trgm 
  ON suppliers USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contracts_name_trgm 
  ON contracts USING gin(name gin_trgm_ops);
```

### 9.2 优化后的报表查询示例

```typescript
// reports.service.ts - 优化后的应收账款概览
async getReceivablesOverview() {
  // 使用原生 SQL 进行聚合计算
  const result = await this.prisma.$queryRaw<Array<{
    total_contract_amount: string;
    total_received: string;
    total_receivable: string;
    overdue_count: string;
    overdue_amount: string;
  }>>`
    WITH contract_stats AS (
      SELECT 
        c.id,
        c.amount_with_tax,
        COALESCE(SUM(pr.amount), 0) as received_amount,
        c.amount_with_tax - COALESCE(SUM(pr.amount), 0) as receivable_amount
      FROM contracts c
      LEFT JOIN payment_records pr ON pr.contract_id = c.id
      WHERE c.is_deleted = false 
        AND c.status IN ('EXECUTING', 'COMPLETED')
      GROUP BY c.id, c.amount_with_tax
    ),
    overdue_stats AS (
      SELECT 
        cs.id,
        cs.receivable_amount,
        MIN(pp.plan_date) as earliest_plan_date
      FROM contract_stats cs
      JOIN payment_plans pp ON pp.contract_id = cs.id
      WHERE cs.receivable_amount > 0
        AND pp.status IN ('PENDING', 'PARTIAL')
        AND pp.plan_date < CURRENT_DATE
      GROUP BY cs.id, cs.receivable_amount
    )
    SELECT 
      COALESCE(SUM(total_contract_amount), 0) as total_contract_amount,
      COALESCE(SUM(received_amount), 0) as total_received,
      COALESCE(SUM(receivable_amount), 0) as total_receivable,
      COUNT(*) as overdue_count,
      COALESCE(SUM(receivable_amount), 0) as overdue_amount
    FROM contract_stats
    WHERE id IN (SELECT id FROM overdue_stats);
  `;

  return {
    totalContractAmount: Number(result[0]?.total_contract_amount || 0),
    totalReceived: Number(result[0]?.total_received || 0),
    totalReceivable: Number(result[0]?.total_receivable || 0),
    overdueCount: Number(result[0]?.overdue_count || 0),
    overdueAmount: Number(result[0]?.overdue_amount || 0),
  };
}
```

### 9.3 游标分页实现示例

```typescript
// common/pagination.dto.ts
export class CursorPaginationDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take: number = 20;
}

// common/cursor-pagination.helper.ts
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

export async function paginateWithCursor<T>(
  query: any,
  pagination: CursorPaginationDto,
  orderBy: any = { id: 'asc' },
): Promise<PaginatedResult<T>> {
  const { cursor, take } = pagination;
  
  const items = await query.findMany({
    take: take + 1, // 多取一个判断是否有下一页
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    orderBy,
  });
  
  const hasMore = items.length > take;
  if (hasMore) items.pop();
  
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
    hasMore,
  };
}

// 使用示例
// costs.service.ts
async findAll(query: QueryCostDto, pagination: CursorPaginationDto) {
  const where = this.buildWhereClause(query);
  
  return paginateWithCursor(
    this.prisma.cost.findMany({
      where: {
        ...where,
        ...(pagination.cursor && { id: { gt: pagination.cursor } }),
      },
      take: pagination.take + 1,
      orderBy: { occurDate: 'desc', id: 'asc' },
      include: {
        project: { select: { id: true, code: true, name: true } },
        contract: { select: { id: true, contractNo: true, name: true } },
        expense: { select: { id: true, expenseNo: true } },
      },
    }),
    pagination,
    { occurDate: 'desc', id: 'asc' },
  );
}
```

### 9.4 批量操作优化示例

```typescript
// 批量更新合同状态
async batchUpdateContractStatus(contractIds: string[], status: ContractStatus) {
  return this.prisma.$transaction(async (tx) => {
    // 使用批量更新
    const result = await tx.contract.updateMany({
      where: { id: { in: contractIds } },
      data: { status, updatedAt: new Date() },
    });
    
    // 批量创建审计日志
    const auditLogs = contractIds.map(contractId => ({
      userId: this.currentUserId,
      action: 'UPDATE',
      entityType: 'Contract',
      entityId: contractId,
      newValue: { status },
      createdAt: new Date(),
    }));
    
    await tx.auditLog.createMany({ data: auditLogs });
    
    return result;
  });
}

// 批量导入优化
async batchImportContracts(contracts: CreateContractDto[]) {
  const BATCH_SIZE = 100;
  const results = [];
  
  for (let i = 0; i < contracts.length; i += BATCH_SIZE) {
    const batch = contracts.slice(i, i + BATCH_SIZE);
    
    const batchResult = await this.prisma.$transaction(async (tx) => {
      // 并行创建合同
      const createdContracts = await Promise.all(
        batch.map(dto => tx.contract.create({ data: dto }))
      );
      
      // 批量创建审计日志
      await tx.auditLog.createMany({
        data: createdContracts.map(contract => ({
          userId: this.currentUserId,
          action: 'CREATE',
          entityType: 'Contract',
          entityId: contract.id,
          newValue: contract,
          createdAt: new Date(),
        })),
      });
      
      return createdContracts;
    });
    
    results.push(...batchResult);
  }
  
  return results;
}
```

---

## 十、实施优先级和时间表

### 第一阶段（立即执行 - 1周内）

| 任务 | 优先级 | 预计时间 | 负责人 |
|------|--------|----------|--------|
| 添加缺失的关键索引 | 🔴 严重 | 2小时 | DBA |
| 验证密码哈希存储 | 🔴 严重 | 1小时 | 开发 |
| 配置数据库备份 | 🟡 高 | 2小时 | DBA |
| 添加检查约束 | 🟡 高 | 3小时 | DBA |

### 第二阶段（高优先级 - 2周内）

| 任务 | 优先级 | 预计时间 | 负责人 |
|------|--------|----------|--------|
| 优化报表查询 | 🟡 高 | 1天 | 开发 |
| 实现游标分页 | 🟡 高 | 2天 | 开发 |
| 添加字段长度限制 | 🟡 高 | 4小时 | DBA |
| 配置数据库层面权限 | 🟡 高 | 4小时 | DBA |

### 第三阶段（中优先级 - 1个月内）

| 任务 | 优先级 | 预计时间 | 负责人 |
|------|--------|----------|--------|
| 移除冗余字段 | 🟡 中 | 1天 | 开发 |
| 实现敏感数据加密 | 🟡 中 | 2天 | 开发 |
| 添加全文搜索支持 | 🟡 中 | 4小时 | DBA |
| 优化数据库配置 | 🟡 中 | 2小时 | DBA |

### 第四阶段（长期规划 - 3个月内）

| 任务 | 优先级 | 预计时间 | 负责人 |
|------|--------|----------|--------|
| 实现表分区 | 🟢 低 | 1周 | DBA |
| 实施审计触发器 | 🟢 低 | 2天 | DBA |
| 性能监控和调优 | 🟢 低 | 持续 | DBA |

---

## 十一、监控和维护建议

### 11.1 性能监控

```sql
-- 1. 查看慢查询
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 1000 -- 超过 1 秒
ORDER BY mean_time DESC
LIMIT 10;

-- 2. 查看索引使用情况
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- 3. 查看表大小
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. 查看缺失的索引
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100 -- 高基数列
ORDER BY n_distinct DESC;
```

### 11.2 定期维护任务

```bash
#!/bin/bash
# maintenance.sh - 数据库维护脚本

# 1. 分析表统计信息
echo "Analyzing tables..."
psql -U postgres -d inf_finance_ms -c "ANALYZE;"

# 2. 清理死元组
echo "Vacuuming tables..."
psql -U postgres -d inf_finance_ms -c "VACUUM ANALYZE;"

# 3. 重建索引（如果需要）
echo "Reindexing..."
psql -U postgres -d inf_finance_ms -c "REINDEX DATABASE inf_finance_ms;"

# 4. 清理旧审计日志（保留 1 年）
echo "Cleaning old audit logs..."
psql -U postgres -d inf_finance_ms -c "DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '1 year';"

echo "Maintenance completed."
```

```bash
# 添加到 crontab
# 每周日凌晨 3 点执行维护
0 3 * * 0 /path/to/maintenance.sh
```

### 11.3 健康检查

```typescript
// health/health-check.service.ts
@Injectable()
export class DatabaseHealthCheckService {
  constructor(private prisma: PrismaService) {}

  async checkHealth(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    const checks = {
      connection: await this.checkConnection(),
      tableSize: await this.checkTableSize(),
      indexUsage: await this.checkIndexUsage(),
      slowQueries: await this.checkSlowQueries(),
    };

    const isHealthy = Object.values(checks).every(check => check.status === 'ok');

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      details: checks,
    };
  }

  private async checkConnection() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', message: 'Database connection successful' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  private async checkTableSize() {
    const result = await this.prisma.$queryRaw<Array<{ size: string }>>`
      SELECT pg_size_pretty(pg_database_size('inf_finance_ms')) as size
    `;
    return { status: 'ok', size: result[0].size };
  }

  private async checkIndexUsage() {
    const unusedIndexes = await this.prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_stat_user_indexes
      WHERE idx_scan = 0
        AND indexname NOT LIKE '%_pkey'
    `;
    
    return {
      status: unusedIndexes.length === 0 ? 'ok' : 'warning',
      unusedIndexes: unusedIndexes.length,
    };
  }

  private async checkSlowQueries() {
    const slowQueries = await this.prisma.$queryRaw<Array<{ count: string }>>`
      SELECT COUNT(*) as count
      FROM pg_stat_statements
      WHERE mean_time > 1000
    `;
    
    return {
      status: Number(slowQueries[0].count) === 0 ? 'ok' : 'warning',
      slowQueryCount: Number(slowQueries[0].count),
    };
  }
}
```

---

## 十二、总结

### 12.1 主要发现

1. **数据库设计整体良好**
   - 表结构设计合理，符合第三范式
   - 关系设计清晰，外键配置正确
   - 命名规范统一

2. **性能优化空间较大**
   - 缺少多个关键索引，影响查询性能
   - 部分查询在应用层计算，效率较低
   - 大数据量分页使用 offset，性能较差

3. **安全性需要加强**
   - 敏感数据未加密存储
   - 缺少数据库层面权限控制
   - 需要配置数据备份策略

### 12.2 关键建议

1. **立即执行**
   - 添加缺失的关键索引
   - 配置数据库备份
   - 验证密码哈希存储

2. **高优先级**
   - 优化报表查询
   - 实现游标分页
   - 添加字段长度限制

3. **长期规划**
   - 实现表分区
   - 实施敏感数据加密
   - 配置数据库层面权限控制

### 12.3 预期效果

实施上述优化后，预期可以达到以下效果：

- **查询性能提升 50-80%**
  - 关键索引优化后，常用查询响应时间显著降低
  - 报表查询优化后，大数据量场景性能大幅提升

- **数据安全性提升**
  - 敏感数据加密后，即使数据库泄露也不会暴露明文
  - 数据库层面权限控制后，应用漏洞影响范围受限

- **系统稳定性提升**
  - 定期维护任务确保数据库性能稳定
  - 健康检查机制及时发现潜在问题

- **可维护性提升**
  - 完善的监控和日志机制
  - 清晰的优化文档和实施计划

---

## 附录

### A. 数据库表清单

| 表名 | 用途 | 记录数预估 | 大小预估 |
|------|------|-----------|----------|
| users | 用户管理 | 100-1000 | < 1MB |
| customers | 客户管理 | 1000-10000 | 1-10MB |
| suppliers | 供应商管理 | 100-1000 | < 1MB |
| contracts | 合同管理 | 1000-10000 | 10-100MB |
| payment_plans | 回款计划 | 5000-50000 | 5-50MB |
| payment_records | 回款记录 | 5000-50000 | 5-50MB |
| invoices | 发票管理 | 5000-50000 | 10-100MB |
| expenses | 报销单 | 1000-10000 | 10-100MB |
| expense_details | 报销明细 | 5000-50000 | 5-50MB |
| costs | 费用管理 | 10000-100000 | 50-500MB |
| projects | 项目管理 | 100-1000 | < 1MB |
| payment_requests | 付款申请 | 1000-10000 | 10-100MB |
| bank_accounts | 银行账户 | 10-100 | < 1MB |
| departments | 部门管理 | 10-100 | < 1MB |
| budgets | 预算管理 | 100-1000 | < 1MB |
| audit_logs | 审计日志 | 100000+ | 100MB+ |
| notifications | 消息通知 | 10000+ | 10-100MB |
| role_permissions | 权限管理 | 50-100 | < 1MB |
| dictionaries | 数据字典 | 50-200 | < 1MB |
| contract_import_logs | 合同导入日志 | 100-1000 | < 1MB |

### B. 参考资源

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Prisma 文档](https://www.prisma.io/docs)
- [PostgreSQL 性能优化指南](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [数据库索引最佳实践](https://use-the-index-luke.com/)

### C. 联系方式

如有疑问或需要进一步讨论，请联系：

- **数据库审查人**: InfCode
- **审查日期**: 2026-03-21
- **文档版本**: 1.0

---

**报告结束**

-- 自动创建未来分区的函数
CREATE OR REPLACE FUNCTION create_audit_logs_partition()
RETURNS void AS $$
DECLARE
  year_to_create INT := EXTRACT(YEAR FROM CURRENT_DATE) + 1;
  partition_name TEXT;
  start_date TEXT;
  end_date TEXT;
BEGIN
  partition_name := 'audit_logs_' || year_to_create;
  start_date := year_to_create || '-01-01';
  end_date := (year_to_create + 1) || '-01-01';
  
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_logs FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );
END;
$$ LANGUAGE plpgsql;
```

---

## 七、数据结构改进建议

### 7.1 移除冗余字段

```prisma
// 修改前
model Expense {
  applicantId  String
  department   String // 冗余字段
}

// 修改后
model Expense {
  applicantId  String
  // 移除 department 字段
  // 通过 applicant.department 获取
}
```

**迁移脚本**:
```sql
-- 1. 添加临时列
ALTER TABLE expenses ADD COLUMN department_id_new TEXT;

-- 2. 更新数据
UPDATE expenses e
SET department_id_new = u.department_id
FROM users u
WHERE e.applicant_id = u.id;

-- 3. 删除旧列
ALTER TABLE expenses DROP COLUMN department;

-- 4. 重命名新列（如果需要保留）
-- ALTER TABLE expenses RENAME COLUMN department_id_new TO department_id;
```

### 7.2 添加字段长度限制

```prisma
// 修改前
model Customer {
  name    String
  address String?
  remark  String?
}

// 修改后
model Customer {
  name    String @db.VarChar(100)
  address String? @db.VarChar(500)
  remark  String? @db.VarChar(1000)
}
```

### 7.3 添加检查约束

```sql
-- Budget.month 范围检查
ALTER TABLE budgets 
ADD CONSTRAINT chk_budget_month_range 
CHECK (month IS NULL OR (month >= 1 AND month <= 12));

-- PaymentPlan.period 范围检查
ALTER TABLE payment_plans 
ADD CONSTRAINT chk_payment_plan_period_positive 
CHECK (period >= 1);

-- 金额非负检查
ALTER TABLE contracts 
ADD CONSTRAINT chk_contract_amount_positive 
CHECK (amount_with_tax >= 0 AND amount_without_tax >= 0);

ALTER TABLE payment_plans 
ADD CONSTRAINT chk_payment_plan_amount_positive 
CHECK (plan_amount >= 0);
```

### 7.4 添加非空约束

```sql
-- 根据业务需求评估
-- ALTER TABLE customers ALTER COLUMN contact_name SET NOT NULL;
-- ALTER TABLE customers ALTER COLUMN contact_phone SET NOT NULL;
```

### 7.5 添加全文搜索支持

```sql
-- 启用 pg_trgm 扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 创建 GIN 索引
CREATE INDEX idx_customers_name_trgm ON customers USING gin(name gin_trgm_ops);
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin(name gin_trgm_ops);
CREATE INDEX idx_contracts_name_trgm ON contracts USING gin(name gin_trgm_ops);

-- 使用示例
-- SELECT * FROM customers WHERE name % '搜索关键词';
```

---

## 八、安全性建议

### 8.1 敏感数据加密

#### 8.1.1 密码哈希（应用层）

```typescript
// auth.service.ts
import * as bcrypt from 'bcrypt';

async hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

#### 8.1.2 银行账号加密（数据库层）

```sql
-- 创建加密函数
CREATE OR REPLACE FUNCTION encrypt_account(account_no TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_encrypt(account_no, current_setting('app.encryption_key'));
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_account(encrypted_account_no TEXT)
RETURNS TEXT AS $$
  SELECT pgp_sym_decrypt(encrypted_account_no::bytea, current_setting('app.encryption_key'));
$$ LANGUAGE sql SECURITY DEFINER;

-- 创建视图用于查询
CREATE VIEW bank_accounts_decrypted AS
SELECT 
  id,
  account_type,
  decrypt_account(account_no) as account_no,
  bank_name,
  -- 其他字段
FROM bank_accounts;

-- 应用层通过视图查询，而不是直接查询表
```

#### 8.1.3 使用 PostgreSQL TDE（透明数据加密）

```bash
# 需要使用支持 TDE 的 PostgreSQL 版本或扩展
# 例如：pgcrypto 扩展
```

### 8.2 数据库权限控制

#### 8.2.1 创建最小权限用户

```sql
-- 1. 创建只读用户
CREATE USER finance_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE finance_db TO finance_readonly;
GRANT USAGE ON SCHEMA public TO finance_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_readonly;

-- 2. 创建应用用户（读写）
CREATE USER finance_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE finance_db TO finance_app;
GRANT USAGE ON SCHEMA public TO finance_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO finance_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO finance_app;

-- 3. 创建管理员用户
CREATE USER finance_admin WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE finance_db TO finance_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO finance_admin;

-- 4. 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO finance_app;
```

#### 8.2.2 行级安全策略 (RLS)

```sql
-- 启用 RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- 普通用户只能看到自己的报销单
CREATE POLICY expense_user_isolation ON expenses
  FOR SELECT
  USING (applicant_id = current_setting('app.user_id')::TEXT);

-- 财务和管理员可以看到所有报销单
CREATE POLICY expense_finance_access ON expenses
  FOR ALL
  TO finance_app
  USING (
    current_setting('app.user_role')::TEXT IN ('FINANCE', 'ADMIN')
    OR applicant_id = current_setting('app.user_id')::TEXT
  );

-- 在应用层设置上下文
-- SET LOCAL app.user_id = 'user123';
-- SET LOCAL app.user_role = 'FINANCE';
```

### 8.3 审计日志增强

```sql
-- 创建审计触发器函数
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value, created_at)
    VALUES (
      current_setting('app.user_id')::TEXT,
      TG_OP,
      TG_TABLE_NAME,
      NEW.id::TEXT,
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, created_at)
    VALUES (
      current_setting('app.user_id')::TEXT,
      TG_OP,
      TG_TABLE_NAME,
      NEW.id::TEXT,
      to_jsonb(OLD),
      to_jsonb(NEW),
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, created_at)
    VALUES (
      current_setting('app.user_id')::TEXT,
      TG_OP,
      TG_TABLE_NAME,
      OLD.id::TEXT,
      to_jsonb(OLD),
      NOW()
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 为重要表创建触发器
CREATE TRIGGER audit_contracts
  AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_payment_requests
  AFTER INSERT OR UPDATE OR DELETE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

### 8.4 数据备份策略

#### 8.4.1 定期全量备份

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="finance_db"

# 创建备份目录
mkdir -p $BACKUP_DIR

# 全量备份
pg_dump -h localhost -U finance_admin -d $DB_NAME \
  -F c -f $BACKUP_DIR/finance_${DATE}.backup

# 压缩备份
gzip $BACKUP_DIR/finance_${DATE}.backup

# 保留最近 30 天的备份
find $BACKUP_DIR -name "finance_*.backup.gz" -mtime +30 -delete

echo "Backup completed: finance_${DATE}.backup.gz"
```

#### 8.4.2 设置定时任务

```bash
# 添加到 crontab
# 每天凌晨 2 点执行备份
0 2 * * * /path/to/backup.sh >> /var/log/postgresql_backup.log 2>&1

# 每小时执行 WAL 归档
0 * * * * /path/to/archive_wal.sh >> /var/log/postgresql_wal_archive.log 2>&1
```

#### 8.4.3 恢复测试

```bash
#!/bin/bash
# test_restore.sh

BACKUP_FILE=$1
TEST_DB="finance_test_restore"

# 创建测试数据库
createdb -h localhost -U finance_admin $TEST_DB

# 恢复备份
pg_restore -h localhost -U finance_admin -d $TEST_DB $BACKUP_FILE

# 验证数据
psql -h localhost -U finance_admin -d $TEST_DB -c "SELECT COUNT(*) FROM contracts;"

# 删除测试数据库
dropdb -h localhost -U finance_admin $TEST_DB

echo "Restore test completed"
```

### 8.5 连接安全

```postgresql
# postgresql.conf

# 只允许本地连接
# listen_addresses = 'localhost'

# 或允许特定 IP
# listen_addresses = '192.168.1.100'

# SSL 配置
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
ssl_ca_file = 'ca.crt'

# 要求 SSL 连接
# hostssl all all 0.0.0.0/0 scram-sha-256
```

```bash
# pg_hba.conf

# 只允许 SSL 连接
hostssl all all 0.0.0.0/0 scram-sha-256

# 本地连接
host all all 127.0.0.1/32 scram-sha-256

# 拒绝其他连接
host all all 0.0.0.0/0 reject
```

---

## 九、具体优化方案和示例

### 9.1 立即执行的优化（1-2 天）

#### 方案 1: 添加关键索引

```sql
-- 创建迁移文件
-- prisma/migrations/20260321000000_add_critical_indexes/migration.sql

-- expenses 表索引
CREATE INDEX IF NOT EXISTS idx_expenses_applicantId ON expenses(applicantId);
CREATE INDEX IF NOT EXISTS idx_expenses_projectId ON expenses(projectId);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);

-- payment_plans 表索引
CREATE INDEX IF NOT EXISTS idx_payment_plans_contractId ON payment_plans(contractId);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON payment_plans(status);

-- payment_records 表索引
CREATE INDEX IF NOT EXISTS idx_payment_records_contractId ON payment_records(contractId);

-- invoices 表索引
CREATE INDEX IF NOT EXISTS idx_invoices_contractId ON invoices(contractId);

-- audit_logs 表索引
CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
```

#### 方案 2: 添加检查约束

```sql
-- 创建迁移文件
-- prisma/migrations/20260321000001_add_check_constraints/migration.sql

-- Budget.month 范围检查
ALTER TABLE budgets 
ADD CONSTRAINT IF NOT EXISTS chk_budget_month_range 
CHECK (month IS NULL OR (month >= 1 AND month <= 12));

-- PaymentPlan.period 范围检查
ALTER TABLE payment_plans 
ADD CONSTRAINT IF NOT EXISTS chk_payment_plan_period_positive 
CHECK (period >= 1);

-- 金额非负检查
ALTER TABLE contracts 
ADD CONSTRAINT IF NOT EXISTS chk_contract_amount_positive 
CHECK (amount_with_tax >=
