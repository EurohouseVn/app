CREATE TABLE "WorkshopWorker" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL DEFAULT '',
  "roleName" TEXT NOT NULL DEFAULT 'Thợ sản xuất',
  "payType" TEXT NOT NULL DEFAULT 'DAILY',
  "baseRate" INTEGER NOT NULL DEFAULT 0,
  "overtimeRate" INTEGER NOT NULL DEFAULT 0,
  "standardMonthlyDays" INTEGER NOT NULL DEFAULT 26,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkshopWorker_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkshopWorker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkshopAttendance" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "workDate" TIMESTAMP(3) NOT NULL,
  "checkInAt" TIMESTAMP(3),
  "checkOutAt" TIMESTAMP(3),
  "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkshopAttendance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkshopAttendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkshopAttendance_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "WorkshopWorker"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkshopReminder" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "note" TEXT NOT NULL DEFAULT '',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkshopReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkshopReminder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WorkshopReminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "WorkshopWorker_organizationId_active_idx" ON "WorkshopWorker"("organizationId", "active");
CREATE UNIQUE INDEX "WorkshopAttendance_workerId_workDate_key" ON "WorkshopAttendance"("workerId", "workDate");
CREATE INDEX "WorkshopAttendance_organizationId_workDate_idx" ON "WorkshopAttendance"("organizationId", "workDate");
CREATE INDEX "WorkshopReminder_organizationId_dueAt_idx" ON "WorkshopReminder"("organizationId", "dueAt");
CREATE INDEX "WorkshopReminder_createdById_idx" ON "WorkshopReminder"("createdById");
