-- CreateTable
CREATE TABLE "NppDeviceSession" (
    "id" TEXT NOT NULL,
    "nppOrgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "NppDeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NppDeviceSession_nppOrgId_kind_revokedAt_idx" ON "NppDeviceSession"("nppOrgId", "kind", "revokedAt");

-- CreateIndex
CREATE INDEX "NppDeviceSession_userId_idx" ON "NppDeviceSession"("userId");

-- AddForeignKey
ALTER TABLE "NppDeviceSession" ADD CONSTRAINT "NppDeviceSession_nppOrgId_fkey" FOREIGN KEY ("nppOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

