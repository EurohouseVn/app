-- AlterTable
ALTER TABLE "NppAccessory" ADD COLUMN "salePrice" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "priceMode" TEXT NOT NULL DEFAULT 'AUTO';

-- CreateTable
CREATE TABLE "OrderColorWeighing" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "basis" TEXT NOT NULL,
    "actualKg" DOUBLE PRECISION NOT NULL,
    "unitPricePerKg" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "OrderColorWeighing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppColorPrice" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL,
    "bundlePricePerKg" INTEGER NOT NULL DEFAULT 0,
    "barePricePerKg" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppColorPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppAccessorySetting" (
    "nppOrgId" TEXT NOT NULL,
    "markupPercent" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppAccessorySetting_pkey" PRIMARY KEY ("nppOrgId")
);

-- CreateIndex
CREATE INDEX "OrderColorWeighing_orderId_idx" ON "OrderColorWeighing"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderColorWeighing_orderId_colorCode_basis_key" ON "OrderColorWeighing"("orderId", "colorCode", "basis");

-- CreateIndex
CREATE UNIQUE INDEX "NppColorPrice_nppOrgId_colorCode_key" ON "NppColorPrice"("nppOrgId", "colorCode");

-- AddForeignKey
ALTER TABLE "OrderColorWeighing" ADD CONSTRAINT "OrderColorWeighing_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
