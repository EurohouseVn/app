-- AlterTable
ALTER TABLE "User" ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refType" TEXT NOT NULL DEFAULT '',
    "refId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "giftName" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PointLedger_userId_idx" ON "PointLedger"("userId");

-- CreateIndex
CREATE INDEX "PointLedger_reason_refId_idx" ON "PointLedger"("reason", "refId");

-- CreateIndex
CREATE INDEX "GiftRedemption_userId_idx" ON "GiftRedemption"("userId");

-- AddForeignKey
ALTER TABLE "PointLedger" ADD CONSTRAINT "PointLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftRedemption" ADD CONSTRAINT "GiftRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftRedemption" ADD CONSTRAINT "GiftRedemption_giftId_fkey" FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
