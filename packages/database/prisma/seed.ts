// InfFinanceMs - 数据库种子数据
// 用于初始化测试数据

import { PrismaClient, Role, ContractStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始初始化种子数据...');

  // 1. 创建管理员用户
  const adminPassword = await bcrypt.hash('Admin@123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@inffinancems.com' },
    update: { password: adminPassword },
    create: {
      email: 'admin@inffinancems.com',
      password: adminPassword,
      name: '系统管理员',
      role: Role.ADMIN,
    },
  });
  console.log('✅ 创建管理员:', admin.email);

  // 2. 创建财务用户
  const financePassword = await bcrypt.hash('Finance@123', 10);
  const finance = await prisma.user.upsert({
    where: { email: 'finance@inffinancems.com' },
    update: { password: financePassword },
    create: {
      email: 'finance@inffinancems.com',
      password: financePassword,
      name: '财务小王',
      role: Role.FINANCE,
    },
  });
  console.log('✅ 创建财务用户:', finance.email);

  // 3. 创建管理层用户
  const managerPassword = await bcrypt.hash('Manager@123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@inffinancems.com' },
    update: { password: managerPassword },
    create: {
      email: 'manager@inffinancems.com',
      password: managerPassword,
      name: '张总',
      role: Role.MANAGER,
    },
  });
  console.log('✅ 创建管理层用户:', manager.email);

  // 4. 创建普通员工
  const employeePassword = await bcrypt.hash('Employee@123', 10);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@inffinancems.com' },
    update: { password: employeePassword },
    create: {
      email: 'employee@inffinancems.com',
      password: employeePassword,
      name: '李员工',
      role: Role.EMPLOYEE,
    },
  });
  console.log('✅ 创建普通员工:', employee.email);

  // 5. 创建数据字典 - 客户类型
  await prisma.dictionary.createMany({
    data: [
      { type: 'CUSTOMER_TYPE', code: 'ENTERPRISE', name: '企业', color: 'blue', sortOrder: 1, isDefault: true },
      { type: 'CUSTOMER_TYPE', code: 'INDIVIDUAL', name: '个人', color: 'green', sortOrder: 2 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ 创建数据字典: 客户类型');

  // 5.1 创建数据字典 - 报销类型
  await prisma.dictionary.createMany({
    data: [
      { type: 'EXPENSE_TYPE', code: 'TRAVEL', name: '差旅费', color: 'blue', sortOrder: 1, isDefault: true },
      { type: 'EXPENSE_TYPE', code: 'ACCOMMODATION', name: '住宿费', color: 'cyan', sortOrder: 2 },
      { type: 'EXPENSE_TYPE', code: 'TRANSPORTATION', name: '交通费', color: 'green', sortOrder: 3 },
      { type: 'EXPENSE_TYPE', code: 'ENTERTAINMENT', name: '招待费', color: 'orange', sortOrder: 4 },
      { type: 'EXPENSE_TYPE', code: 'TEAM_BUILDING', name: '团建费', color: 'purple', sortOrder: 5 },
      { type: 'EXPENSE_TYPE', code: 'COMMUNICATION', name: '通讯费', color: 'geekblue', sortOrder: 6 },
      { type: 'EXPENSE_TYPE', code: 'OTHER', name: '其他', color: 'default', sortOrder: 7 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ 创建数据字典: 报销类型');

  // 5.2 创建示例项目
  const project1 = await prisma.project.upsert({
    where: { code: 'PRJ000001' },
    update: {},
    create: {
      code: 'PRJ000001',
      name: '智能财务系统开发项目',
      description: '为企业开发智能化财务管理系统',
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
    },
  });
  console.log('✅ 创建项目:', project1.name);

  const project2 = await prisma.project.upsert({
    where: { code: 'PRJ000002' },
    update: {},
    create: {
      code: 'PRJ000002',
      name: '企业数字化转型咨询',
      description: '为客户提供数字化转型咨询服务',
      status: 'ACTIVE',
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-08-31'),
    },
  });
  console.log('✅ 创建项目:', project2.name);

  const project3 = await prisma.project.upsert({
    where: { code: 'PRJ000003' },
    update: {},
    create: {
      code: 'PRJ000003',
      name: '日常运营支出',
      description: '公司日常运营相关费用',
      status: 'ACTIVE',
    },
  });
  console.log('✅ 创建项目:', project3.name);

  // 5.3 创建数据字典 - 合同类型
  await prisma.dictionary.createMany({
    data: [
      { type: 'CONTRACT_TYPE', code: 'SALES', name: '销售合同', color: 'blue', sortOrder: 1, isDefault: true },
      { type: 'CONTRACT_TYPE', code: 'PURCHASE', name: '采购合同', color: 'cyan', sortOrder: 2 },
      { type: 'CONTRACT_TYPE', code: 'SERVICE', name: '服务合同', color: 'green', sortOrder: 3 },
      { type: 'CONTRACT_TYPE', code: 'OTHER', name: '其他', color: 'default', sortOrder: 4 },
    ],
    skipDuplicates: true,
  });
  console.log('✅ 创建数据字典: 合同类型');

  // 6. 创建示例客户
  const customer1 = await prisma.customer.upsert({
    where: { code: 'CUS000001' },
    update: {},
    create: {
      code: 'CUS000001',
      name: '北京科技有限公司',
      type: 'ENTERPRISE', // 使用字典编码
      creditCode: '91110000MA00ABCD1X',
      contactName: '王经理',
      contactPhone: '13800138001',
      contactEmail: 'wang@bjtech.com',
      address: '北京市朝阳区科技园区A座',
    },
  });
  console.log('✅ 创建客户:', customer1.name);

  const customer2 = await prisma.customer.upsert({
    where: { code: 'CUS000002' },
    update: {},
    create: {
      code: 'CUS000002',
      name: '上海贸易有限公司',
      type: 'ENTERPRISE', // 使用字典编码
      creditCode: '91310000MA00EFGH2Y',
      contactName: '李总',
      contactPhone: '13900139002',
      contactEmail: 'li@shtrade.com',
      address: '上海市浦东新区商务中心B栋',
    },
  });
  console.log('✅ 创建客户:', customer2.name);

  // 6. 创建示例合同
  const contract1 = await prisma.contract.upsert({
    where: { contractNo: 'HT202601-0001' },
    update: {},
    create: {
      contractNo: 'HT202601-0001',
      name: '软件开发服务合同',
      customerId: customer1.id,
      signingEntity: 'InfFinanceMs',
      contractType: 'SERVICE',
      amountWithTax: 100000,
      amountWithoutTax: 88495.58,
      taxRate: 13,
      signDate: new Date('2026-01-15'),
      startDate: new Date('2026-01-20'),
      endDate: new Date('2026-06-30'),
      status: ContractStatus.EXECUTING,
    },
  });
  console.log('✅ 创建合同:', contract1.contractNo);

  // 7. 创建回款计划
  await prisma.paymentPlan.createMany({
    data: [
      {
        contractId: contract1.id,
        period: 1,
        planAmount: 30000,
        planDate: new Date('2026-02-01'),
      },
      {
        contractId: contract1.id,
        period: 2,
        planAmount: 40000,
        planDate: new Date('2026-04-01'),
      },
      {
        contractId: contract1.id,
        period: 3,
        planAmount: 30000,
        planDate: new Date('2026-06-30'),
      },
    ],
    skipDuplicates: true,
  });
  console.log('✅ 创建回款计划: 3期');

  console.log('🎉 种子数据初始化完成！');
  console.log('');
  console.log('📋 测试账号信息:');
  console.log('  管理员: admin@inffinancems.com / Admin@123');
  console.log('  财务: finance@inffinancems.com / Finance@123');
  console.log('  管理层: manager@inffinancems.com / Manager@123');
  console.log('  员工: employee@inffinancems.com / Employee@123');
}

main()
  .catch((e) => {
    console.error('❌ 种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
