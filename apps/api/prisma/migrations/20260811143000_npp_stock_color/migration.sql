ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode");

CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode");
CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode");
