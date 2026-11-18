ALTER TABLE "WorkshopWorker"
ADD COLUMN "sundayPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "sundayPayPercent" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN "holidayPayEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "holidayPayPercent" INTEGER NOT NULL DEFAULT 300;

CREATE TABLE "WorkshopWorkdaySetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL DEFAULT 'Lễ/Tết',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkshopWorkdaySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkshopWorkdaySetting_organizationId_workDate_key"
ON "WorkshopWorkdaySetting"("organizationId", "workDate");

CREATE INDEX "WorkshopWorkdaySetting_organizationId_workDate_idx"
ON "WorkshopWorkdaySetting"("organizationId", "workDate");

ALTER TABLE "WorkshopWorkdaySetting"
ADD CONSTRAINT "WorkshopWorkdaySetting_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
