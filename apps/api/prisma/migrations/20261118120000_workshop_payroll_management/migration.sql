-- AlterTable
ALTER TABLE "WorkshopWorker" ADD COLUMN     "insuranceEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "insuranceSalary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paidLeaveDaysPerMonth" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "WorkshopPieceJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT NOT NULL DEFAULT '',
    "workDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopPieceJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopPieceJobShare" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "WorkshopPieceJobShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopPayAdjustment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "workDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopPayAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopPayrollClose" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "totalNet" INTEGER NOT NULL DEFAULT 0,
    "closedById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopPayrollClose_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopPieceJob_organizationId_workDate_idx" ON "WorkshopPieceJob"("organizationId", "workDate");

-- CreateIndex
CREATE INDEX "WorkshopPieceJobShare_workerId_idx" ON "WorkshopPieceJobShare"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopPieceJobShare_jobId_workerId_key" ON "WorkshopPieceJobShare"("jobId", "workerId");

-- CreateIndex
CREATE INDEX "WorkshopPayAdjustment_organizationId_workDate_idx" ON "WorkshopPayAdjustment"("organizationId", "workDate");

-- CreateIndex
CREATE INDEX "WorkshopPayAdjustment_workerId_workDate_idx" ON "WorkshopPayAdjustment"("workerId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "WorkshopPayrollClose_organizationId_month_key" ON "WorkshopPayrollClose"("organizationId", "month");

-- AddForeignKey
ALTER TABLE "WorkshopPieceJob" ADD CONSTRAINT "WorkshopPieceJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPieceJobShare" ADD CONSTRAINT "WorkshopPieceJobShare_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "WorkshopPieceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPieceJobShare" ADD CONSTRAINT "WorkshopPieceJobShare_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkshopWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPayAdjustment" ADD CONSTRAINT "WorkshopPayAdjustment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPayAdjustment" ADD CONSTRAINT "WorkshopPayAdjustment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkshopWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopPayrollClose" ADD CONSTRAINT "WorkshopPayrollClose_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
