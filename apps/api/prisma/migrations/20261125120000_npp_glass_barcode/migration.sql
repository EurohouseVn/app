-- NPP glass barcode scheme, stock keyed by barcode/kind/location, and an immutable glass movement ledger.
-- Existing NppGlassSheet rows are kept; each gets a unique LEGACY barcode so the new unique key never collides.

-- CreateTable
CREATE TABLE "NppBarcodeScheme" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "glassType" TEXT NOT NULL DEFAULT '',
    "thicknessMm" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppBarcodeScheme_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "NppGlassSheet"
    ADD COLUMN "schemeId" TEXT,
    ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SHEET',
    ADD COLUMN "location" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "barcode" TEXT NOT NULL DEFAULT '';

-- Backfill: unique placeholder barcode for pre-existing rows
UPDATE "NppGlassSheet" SET "barcode" = 'LEGACY-' || "id" WHERE "barcode" = '';

-- CreateTable
CREATE TABLE "NppGlassMovement" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "stockId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NppGlassMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NppBarcodeScheme_nppOrgId_prefix_key" ON "NppBarcodeScheme"("nppOrgId", "prefix");

-- CreateIndex
CREATE INDEX "NppBarcodeScheme_nppOrgId_active_idx" ON "NppBarcodeScheme"("nppOrgId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "NppGlassSheet_nppOrgId_barcode_kind_location_key" ON "NppGlassSheet"("nppOrgId", "barcode", "kind", "location");

-- CreateIndex
CREATE INDEX "NppGlassSheet_schemeId_idx" ON "NppGlassSheet"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "NppGlassMovement_nppOrgId_idempotencyKey_key" ON "NppGlassMovement"("nppOrgId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "NppGlassMovement_stockId_createdAt_idx" ON "NppGlassMovement"("stockId", "createdAt");

-- AddForeignKey
ALTER TABLE "NppBarcodeScheme" ADD CONSTRAINT "NppBarcodeScheme_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppGlassSheet" ADD CONSTRAINT "NppGlassSheet_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "NppBarcodeScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppGlassMovement" ADD CONSTRAINT "NppGlassMovement_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppGlassMovement" ADD CONSTRAINT "NppGlassMovement_stockId_fkey" FOREIGN KEY ("stockId") REFERENCES "NppGlassSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
