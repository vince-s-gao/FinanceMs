-- 合同导入日志（后端持久化）
CREATE TABLE IF NOT EXISTS "contract_import_logs" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT,
  "fileName" TEXT NOT NULL,
  "total" INTEGER NOT NULL,
  "success" INTEGER NOT NULL,
  "failed" INTEGER NOT NULL,
  "allowPartial" BOOLEAN NOT NULL DEFAULT false,
  "errors" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "contract_import_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contract_import_logs_operatorId_createdAt_idx"
  ON "contract_import_logs"("operatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "contract_import_logs_createdAt_idx"
  ON "contract_import_logs"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contract_import_logs_operatorId_fkey'
  ) THEN
    ALTER TABLE "contract_import_logs"
      ADD CONSTRAINT "contract_import_logs_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
