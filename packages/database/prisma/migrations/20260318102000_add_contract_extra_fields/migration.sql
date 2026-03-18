-- 合同管理补充字段：公司签约主体、合同类型
ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "signingEntity" TEXT,
  ADD COLUMN IF NOT EXISTS "contractType" TEXT;

CREATE INDEX IF NOT EXISTS "contracts_signDate_idx" ON "contracts"("signDate");
CREATE INDEX IF NOT EXISTS "contracts_endDate_idx" ON "contracts"("endDate");
CREATE INDEX IF NOT EXISTS "contracts_contractType_idx" ON "contracts"("contractType");
CREATE INDEX IF NOT EXISTS "contracts_signingEntity_idx" ON "contracts"("signingEntity");
CREATE INDEX IF NOT EXISTS "contracts_customerId_signDate_idx" ON "contracts"("customerId", "signDate");
