#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const AUTO_SUPPLIER_REMARK = '由合同自动同步创建，待完善供应商信息';

function normalize(value) {
  return String(value || '').trim();
}

function isSalesType(values) {
  return values.some((value) => {
    const normalized = normalize(value).toUpperCase();
    return normalized.includes('SALES') || normalize(value).includes('销售');
  });
}

async function generateNextSupplierCode(prisma) {
  const last = await prisma.supplier.findFirst({
    where: { code: { startsWith: 'SUP' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });

  let sequence = 1;
  const match = last?.code ? String(last.code).match(/^SUP(\d{6})$/) : null;
  if (match) {
    sequence = Number(match[1]) + 1;
  }
  return `SUP${String(sequence).padStart(6, '0')}`;
}

async function createSupplierIfNotExists(prisma, name) {
  const existed = await prisma.supplier.findFirst({
    where: { isDeleted: false, name },
    select: { id: true },
  });
  if (existed) return false;

  for (let i = 0; i < 8; i += 1) {
    const code = await generateNextSupplierCode(prisma);
    try {
      await prisma.supplier.create({
        data: {
          code,
          name,
          type: 'CORPORATE',
          remark: AUTO_SUPPLIER_REMARK,
        },
      });
      return true;
    } catch (error) {
      if (error && error.code === 'P2002') {
        continue;
      }
      throw error;
    }
  }
  throw new Error(`创建供应商失败: ${name}`);
}

function canAutoDeleteSupplier(supplier) {
  return (
    normalize(supplier.remark) === AUTO_SUPPLIER_REMARK
    && !normalize(supplier.creditCode)
    && !normalize(supplier.contactName)
    && !normalize(supplier.contactPhone)
    && !normalize(supplier.contactEmail)
    && !normalize(supplier.address)
    && !normalize(supplier.bankName)
    && !normalize(supplier.bankAccountName)
    && !normalize(supplier.bankAccountNo)
  );
}

async function main() {
  const forceDeleteSalesOnly = process.argv.includes('--force-delete-sales-only') || process.argv.includes('--force');
  const prisma = new PrismaClient();
  try {
    const [contracts, contractTypeDict] = await Promise.all([
      prisma.contract.findMany({
        where: { isDeleted: false },
        select: {
          contractType: true,
          customer: { select: { name: true } },
        },
      }),
      prisma.dictionary.findMany({
        where: { type: 'CONTRACT_TYPE' },
        select: { code: true, name: true, value: true },
      }),
    ]);

    const hintsByCode = new Map();
    contractTypeDict.forEach((item) => {
      hintsByCode.set(
        normalize(item.code).toLowerCase(),
        [item.code, item.name, item.value].filter((value) => normalize(value)),
      );
    });

    const salesNames = new Set();
    const nonSalesNames = new Set();
    contracts.forEach((contract) => {
      const counterparty = normalize(contract.customer?.name);
      if (!counterparty) return;

      const contractType = normalize(contract.contractType);
      const hints = [
        contractType,
        ...(hintsByCode.get(contractType.toLowerCase()) || []),
      ].filter((value) => normalize(value));

      if (isSalesType(hints)) {
        salesNames.add(counterparty);
      } else {
        nonSalesNames.add(counterparty);
      }
    });

    let createdCount = 0;
    for (const name of nonSalesNames) {
      const created = await createSupplierIfNotExists(prisma, name);
      if (created) createdCount += 1;
    }

    const salesOnlyNames = Array.from(salesNames).filter((name) => !nonSalesNames.has(name));
    let deletedCount = 0;
    if (salesOnlyNames.length > 0) {
      const suppliers = await prisma.supplier.findMany({
        where: {
          isDeleted: false,
          name: { in: salesOnlyNames },
        },
        select: {
          id: true,
          name: true,
          remark: true,
          creditCode: true,
          contactName: true,
          contactPhone: true,
          contactEmail: true,
          address: true,
          bankName: true,
          bankAccountName: true,
          bankAccountNo: true,
        },
      });

      const deletableIds = forceDeleteSalesOnly
        ? suppliers.map((item) => item.id)
        : suppliers.filter(canAutoDeleteSupplier).map((item) => item.id);
      if (deletableIds.length > 0) {
        const result = await prisma.supplier.updateMany({
          where: { id: { in: deletableIds } },
          data: { isDeleted: true },
        });
        deletedCount = result.count;
      }
    }

    console.log(
      JSON.stringify(
        {
          forceDeleteSalesOnly,
          nonSalesCounterpartyCount: nonSalesNames.size,
          salesOnlyCounterpartyCount: salesOnlyNames.length,
          createdSuppliers: createdCount,
          softDeletedMisclassifiedSuppliers: deletedCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
