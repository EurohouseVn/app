-- CreateTable
CREATE TABLE "NppStocktake" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT,
    "appliedById" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppStocktake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppStocktakeScan" (
    "id" TEXT NOT NULL,
    "stocktakeId" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "deviceSessionId" TEXT,
    "actorId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NppStocktakeScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NppStocktake_nppOrgId_status_createdAt_idx" ON "NppStocktake"("nppOrgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NppStocktakeScan_stocktakeId_barcode_kind_location_idx" ON "NppStocktakeScan"("stocktakeId", "barcode", "kind", "location");

-- CreateIndex
CREATE UNIQUE INDEX "NppStocktakeScan_stocktakeId_idempotencyKey_key" ON "NppStocktakeScan"("stocktakeId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "NppStocktake" ADD CONSTRAINT "NppStocktake_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppStocktakeScan" ADD CONSTRAINT "NppStocktakeScan_stocktakeId_fkey" FOREIGN KEY ("stocktakeId") REFERENCES "NppStocktake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

