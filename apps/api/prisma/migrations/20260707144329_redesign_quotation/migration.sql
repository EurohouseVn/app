/*
  Warnings:

  - You are about to drop the column `ownerId` on the `Quotation` table. All the data in the column will be lost.
  - You are about to drop the column `payload` on the `Quotation` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Quotation" DROP COLUMN "ownerId",
DROP COLUMN "payload",
ADD COLUMN     "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "baseAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "profitAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Quotation_createdById_idx" ON "Quotation"("createdById");

-- AddForeignKey
ALTER TABLE "Quotation" ADD CONSTRAINT "Quotation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
