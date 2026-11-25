-- CreateTable
CREATE TABLE "NppPrintJob" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "createdById" TEXT,
    "sourceSessionId" TEXT,
    "labels" JSONB NOT NULL,
    "labelCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "claimedBySessionId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "printedAt" TIMESTAMP(3),
    "error" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppPrintJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NppPrintStation" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "deviceSessionId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NppPrintStation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NppPrintJob_nppOrgId_status_createdAt_idx" ON "NppPrintJob"("nppOrgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "NppPrintStation_nppOrgId_lastSeenAt_idx" ON "NppPrintStation"("nppOrgId", "lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "NppPrintStation_nppOrgId_deviceSessionId_key" ON "NppPrintStation"("nppOrgId", "deviceSessionId");

-- AddForeignKey
ALTER TABLE "NppPrintJob" ADD CONSTRAINT "NppPrintJob_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NppPrintStation" ADD CONSTRAINT "NppPrintStation_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
