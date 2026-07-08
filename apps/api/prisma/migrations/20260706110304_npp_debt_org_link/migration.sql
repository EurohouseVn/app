-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "factoryOrgId" TEXT,
ADD COLUMN     "nppOrgId" TEXT,
ADD COLUMN     "orderId" TEXT;

-- CreateIndex
CREATE INDEX "Debt_nppOrgId_idx" ON "Debt"("nppOrgId");

-- CreateIndex
CREATE INDEX "Debt_factoryOrgId_idx" ON "Debt"("factoryOrgId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_factoryOrgId_fkey" FOREIGN KEY ("factoryOrgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
