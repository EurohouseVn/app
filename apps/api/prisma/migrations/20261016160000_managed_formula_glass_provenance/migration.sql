ALTER TABLE "SystemFormula"
ADD COLUMN "stableKey" TEXT,
ADD COLUMN "glassRules" JSONB,
ADD COLUMN "sourceRef" TEXT NOT NULL DEFAULT '',
ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'CANDIDATE';

CREATE UNIQUE INDEX "SystemFormula_stableKey_key" ON "SystemFormula"("stableKey");
CREATE INDEX "SystemFormula_verificationStatus_idx" ON "SystemFormula"("verificationStatus");
