ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "actualKgPerBar" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "theoreticalTotalKg" DOUBLE PRECISION NOT NULL DEFAULT 0;

UPDATE "Profile"
SET "actualKgPerBar" = ROUND(("kgPerMeter" * ("barLengthMm"::DOUBLE PRECISION / 1000.0))::numeric, 3)::DOUBLE PRECISION
WHERE "actualKgPerBar" = 0;

UPDATE "OrderItem"
SET "theoreticalTotalKg" = "totalKg"
WHERE "theoreticalTotalKg" = 0;
