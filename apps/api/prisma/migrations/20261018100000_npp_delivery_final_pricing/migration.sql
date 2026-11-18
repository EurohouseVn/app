ALTER TABLE "Order"
ADD COLUMN "theoreticalTotalKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "actualTotalKg" DOUBLE PRECISION,
ADD COLUMN "pricingStatus" TEXT NOT NULL DEFAULT 'PENDING_NPP',
ADD COLUMN "finalUnitPricePerKg" INTEGER,
ADD COLUMN "pricingDiscountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pricingSurchargeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pricingNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN "priceConfirmedAt" TIMESTAMP(3),
ADD COLUMN "priceConfirmedById" TEXT;

UPDATE "Order" AS o
SET "theoreticalTotalKg" = COALESCE(
  NULLIF((
    SELECT SUM(CASE WHEN oi."theoreticalTotalKg" > 0 THEN oi."theoreticalTotalKg" ELSE oi."totalKg" END)
    FROM "OrderItem" AS oi
    WHERE oi."orderId" = o."id"
  ), 0),
  o."totalKg"
);

UPDATE "Order"
SET
  "actualTotalKg" = "totalKg",
  "pricingStatus" = 'FINALIZED',
  "finalUnitPricePerKg" = CASE
    WHEN "totalKg" > 0 AND "totalAmount" > 0 THEN ROUND("totalAmount" / "totalKg")::INTEGER
    ELSE NULL
  END,
  "priceConfirmedAt" = "updatedAt"
WHERE
  "sourceType" = 'ADMIN_TO_NPP'
  OR ("status" IN ('SHIPPED', 'DELIVERED', 'COMPLETED') AND "totalAmount" > 0);

UPDATE "Order"
SET
  "totalAmount" = 0,
  "pricingStatus" = 'PENDING_NPP'
WHERE
  "sourceType" <> 'ADMIN_TO_NPP'
  AND "status" NOT IN ('SHIPPED', 'DELIVERED', 'COMPLETED');
