-- Reconcile databases that were originally created with db push or an early migration set.
-- All statements are additive and idempotent so existing Render data is preserved.

CREATE TABLE IF NOT EXISTS "NppProfileStock" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL DEFAULT '',
    "stockBars" INTEGER NOT NULL DEFAULT 0,
    "lowStockAlert" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NppProfileStock_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NppStockMovement" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL DEFAULT '',
    "direction" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "createdById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NppStockMovement_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrgId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_createdById_clientRequestId_key" ON "Order"("createdById", "clientRequestId");
CREATE INDEX IF NOT EXISTS "Order_factoryOrgId_idx" ON "Order"("factoryOrgId");
UPDATE "Order" AS orders
SET "factoryOrgId" = users."organizationId"
FROM "User" AS users
JOIN "Organization" AS organizations ON organizations."id" = users."organizationId" AND organizations."type" = 'FACTORY'
WHERE orders."createdById" = users."id" AND orders."factoryOrgId" IS NULL;
DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode");
CREATE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_idx" ON "NppProfileStock"("nppOrgId");
CREATE INDEX IF NOT EXISTS "NppProfileStock_profileId_idx" ON "NppProfileStock"("profileId");
CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode");
CREATE INDEX IF NOT EXISTS "NppStockMovement_nppOrgId_idx" ON "NppStockMovement"("nppOrgId");
CREATE INDEX IF NOT EXISTS "NppStockMovement_profileId_idx" ON "NppStockMovement"("profileId");
CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode");
CREATE INDEX IF NOT EXISTS "NppStockMovement_orderId_idx" ON "NppStockMovement"("orderId");
CREATE INDEX IF NOT EXISTS "NppStockMovement_createdAt_idx" ON "NppStockMovement"("createdAt");

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerPhone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerAddress" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "baseAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "profitAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "vatPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "vatAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "extraProducts" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "isFinalSettlement" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "depositAmount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS "QuotationItem" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "system" TEXT NOT NULL DEFAULT '',
    "doorType" TEXT NOT NULL DEFAULT '',
    "templateId" TEXT,
    "widthMm" INTEGER NOT NULL DEFAULT 0,
    "heightMm" INTEGER NOT NULL DEFAULT 0,
    "wallHugging" TEXT NOT NULL DEFAULT 'Non',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "includesAccessories" BOOLEAN NOT NULL DEFAULT true,
    "accessoriesPrice" INTEGER NOT NULL DEFAULT 0,
    "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerM2" INTEGER NOT NULL DEFAULT 0,
    "totalPrice" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "glassType" TEXT,
    "glassColor" TEXT,
    "dynamicInputs" JSONB,
    "formulaSnapshot" JSONB,
    CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "quotationId" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "system" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "doorType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "widthMm" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "heightMm" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "wallHugging" TEXT NOT NULL DEFAULT 'Non';
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "includesAccessories" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "accessoriesPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "pricePerM2" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "totalPrice" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "glassType" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "glassColor" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "dynamicInputs" JSONB;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "formulaSnapshot" JSONB;
CREATE INDEX IF NOT EXISTS "Quotation_createdById_idx" ON "Quotation"("createdById");
CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");

-- Kg thực tế chỉ được cân ở tổng cuối phiếu giao, không quản lý theo từng mã cây.
ALTER TABLE "Profile" DROP COLUMN IF EXISTS "actualKgPerBar";
