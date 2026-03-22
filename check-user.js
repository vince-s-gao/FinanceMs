/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.CHECK_USER_EMAIL || 'admin@inffinancems.com';
  const password = process.env.CHECK_USER_PASSWORD || '';

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      password: true,
    },
  });

  if (!user) {
    console.log(`未找到用户: ${email}`);
    return;
  }

  console.log('用户信息:');
  console.log(`- ID: ${user.id}`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Name: ${user.name}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- IsActive: ${user.isActive}`);
  console.log(`- HasPassword: ${Boolean(user.password)}`);

  if (password && user.password) {
    const matched = await bcrypt.compare(password, user.password);
    console.log(`- PasswordMatched: ${matched}`);
  } else if (!password) {
    console.log(
      '- 未提供 CHECK_USER_PASSWORD，已跳过密码校验',
    );
  }
}

main()
  .catch((error) => {
    console.error('检查失败:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

