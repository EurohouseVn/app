ALTER TABLE "DoorModel"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'LEGACY_REFERENCE',
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SystemFormula"
ADD COLUMN "inputSchema" JSONB,
ADD COLUMN "cutRules" JSONB,
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "publishedAt" TIMESTAMP(3);

CREATE INDEX "DoorModel_source_active_idx" ON "DoorModel"("source", "active");
CREATE INDEX "SystemFormula_status_idx" ON "SystemFormula"("status");
