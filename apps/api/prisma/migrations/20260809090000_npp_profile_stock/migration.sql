-- CreateTable
CREATE TABLE "NppProfileStock" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "stockBars" INTEGER NOT NULL DEFAULT 0,
    "lowStockAlert" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppProfileStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppStockMovement" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "orderId" TEXT,
    "createdById" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NppStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NppProfileStock_nppOrgId_profileId_key" ON "NppProfileStock"("nppOrgId", "profileId");

-- CreateIndex
CREATE INDEX "NppProfileStock_nppOrgId_idx" ON "NppProfileStock"("nppOrgId");

-- CreateIndex
CREATE INDEX "NppProfileStock_profileId_idx" ON "NppProfileStock"("profileId");

-- CreateIndex
CREATE INDEX "NppStockMovement_nppOrgId_idx" ON "NppStockMovement"("nppOrgId");

-- CreateIndex
CREATE INDEX "NppStockMovement_profileId_idx" ON "NppStockMovement"("profileId");

-- CreateIndex
CREATE INDEX "NppStockMovement_orderId_idx" ON "NppStockMovement"("orderId");

-- CreateIndex
CREATE INDEX "NppStockMovement_createdAt_idx" ON "NppStockMovement"("createdAt");

-- AddForeignKey
ALTER TABLE "NppProfileStock" ADD CONSTRAINT "NppProfileStock_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppProfileStock" ADD CONSTRAINT "NppProfileStock_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppStockMovement" ADD CONSTRAINT "NppStockMovement_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppStockMovement" ADD CONSTRAINT "NppStockMovement_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppStockMovement" ADD CONSTRAINT "NppStockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppStockMovement" ADD CONSTRAINT "NppStockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
