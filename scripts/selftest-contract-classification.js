#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { ContractsService } = require('../apps/api/dist/modules/contracts/contracts.service');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function fail(message, details) {
  console.error('[SELFTEST FAILED]', message);
  if (details) {
    console.error(JSON.stringify(details, null, 2));
  }
  process.exit(1);
}

async function upsertContractType(prisma, code, name) {
  const existing = await prisma.dictionary.findFirst({
    where: {
      type: 'CONTRACT_TYPE',
      OR: [
        { code: { equals: code, mode: 'insensitive' } },
        { name: { equals: name, mode: 'insensitive' } },
      ],
    },
    select: { id: true, code: true },
  });

  if (existing) {
    if (existing.code !== code) {
      await prisma.dictionary.update({
        where: { id: existing.id },
        data: { code, name, value: name, isEnabled: true },
      });
    }
    return;
  }

  await prisma.dictionary.create({
    data: {
      type: 'CONTRACT_TYPE',
      code,
      name,
      value: name,
      color: 'default',
      sortOrder: 999,
      isEnabled: true,
      isDefault: false,
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  const uploadServiceStub = {
    getFilePath(fileUrl) {
      return fileUrl;
    },
  };
  const service = new ContractsService(prisma, uploadServiceStub);

  const salesCounterparty = 'SELFTEST-销售主体-A';
  const nonSalesCounterparty = 'SELFTEST-非销售主体-B';
  const salesContractTypeCode = 'SELFTEST_SALE_CODE';
  const salesContractTypeName = '销售合同(自测)';
  const nonSalesContractTypeCode = 'SELFTEST_SERVICE_CODE';
  const nonSalesContractTypeName = '服务合同(自测)';
  const contractNoPrefix = 'SELFTEST-CLS-';
  const cleanup = async () => {
    await prisma.contract.updateMany({
      where: { contractNo: { startsWith: contractNoPrefix } },
      data: { isDeleted: true },
    });
    await prisma.customer.updateMany({
      where: { name: { in: [salesCounterparty, nonSalesCounterparty] } },
      data: { isDeleted: true },
    });
    await prisma.supplier.updateMany({
      where: { name: { in: [salesCounterparty, nonSalesCounterparty] } },
      data: { isDeleted: true },
    });
  };

  try {
    await upsertContractType(prisma, salesContractTypeCode, salesContractTypeName);
    await upsertContractType(prisma, nonSalesContractTypeCode, nonSalesContractTypeName);

    await cleanup();

    const csv = Buffer.from(
      [
        '合同编号,合同名称,客户名称,公司签约主体,合同类型,合同金额,签署日期,结束日期',
        `${contractNoPrefix}001,销售类自测合同,${salesCounterparty},InfFinanceMs,${salesContractTypeName},1000,2026-03-19,2026-12-31`,
        `${contractNoPrefix}002,非销售类自测合同,${nonSalesCounterparty},InfFinanceMs,${nonSalesContractTypeName},2000,2026-03-19,2026-12-31`,
      ].join('\n'),
      'utf-8',
    );

    const importResult = await service.importCsv(csv, {
      fileName: 'selftest-classification.csv',
      allowPartial: false,
    });

    if (importResult.failed !== 0 || importResult.success !== 2) {
      fail('导入结果不符合预期', importResult);
    }

    const [salesCustomer, nonSalesCustomer, salesSupplier, nonSalesSupplier] = await Promise.all([
      prisma.customer.findFirst({
        where: { name: salesCounterparty },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.customer.findFirst({
        where: { name: nonSalesCounterparty },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.supplier.findFirst({
        where: { name: salesCounterparty, isDeleted: false },
      }),
      prisma.supplier.findFirst({
        where: { name: nonSalesCounterparty, isDeleted: false },
      }),
    ]);

    const assertions = {
      salesCustomerVisible: !!salesCustomer && !salesCustomer.isDeleted,
      nonSalesCustomerHidden: !!nonSalesCustomer && nonSalesCustomer.isDeleted,
      salesSupplierAbsent: !salesSupplier,
      nonSalesSupplierPresent: !!nonSalesSupplier,
    };

    if (
      !assertions.salesCustomerVisible
      || !assertions.nonSalesCustomerHidden
      || !assertions.salesSupplierAbsent
      || !assertions.nonSalesSupplierPresent
    ) {
      fail('分类断言失败', { assertions, salesCustomer, nonSalesCustomer, salesSupplier, nonSalesSupplier });
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          importResult,
          assertions,
        },
        null,
        2,
      ),
    );
    await cleanup();
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  fail(error?.message || '未知错误', error);
});
