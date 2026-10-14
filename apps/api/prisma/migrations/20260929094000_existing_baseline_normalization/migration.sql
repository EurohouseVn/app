-- Normalize the known runtime-DDL footprint after an existing database has
-- adopted migration history. All statements are idempotent and data preserving.
DROP INDEX IF EXISTS "Order_factoryOrgId_idx";
DROP INDEX IF EXISTS "QuotationItem_quotationId_idx";

ALTER TABLE "WorkshopWorker" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WorkshopAttendance" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "WorkshopReminder" ALTER COLUMN "updatedAt" DROP DEFAULT;
