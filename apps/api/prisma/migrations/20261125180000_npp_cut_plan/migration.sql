-- CreateTable
CREATE TABLE "NppCutPlan" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderRef" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "options" JSONB NOT NULL,
    "pieces" JSONB NOT NULL,
    "result" JSONB NOT NULL,
    "sheetsUsed" INTEGER NOT NULL DEFAULT 0,
    "piecesPlaced" INTEGER NOT NULL DEFAULT 0,
    "unplacedCount" INTEGER NOT NULL DEFAULT 0,
    "wastePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppCutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NppCutPlan_nppOrgId_status_createdAt_idx" ON "NppCutPlan"("nppOrgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NppCutPlan_schemeId_idx" ON "NppCutPlan"("schemeId");

-- AddForeignKey
ALTER TABLE "NppCutPlan" ADD CONSTRAINT "NppCutPlan_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppCutPlan" ADD CONSTRAINT "NppCutPlan_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "NppBarcodeScheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

