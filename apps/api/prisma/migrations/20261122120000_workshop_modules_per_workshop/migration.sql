-- Mỗi xưởng (cơ sở FACTORY) có cấu hình thí điểm riêng, độc lập với xưởng khác.
-- Xưởng đã tồn tại mà chưa có cấu hình được bật các module vận hành của xưởng:
-- công trình/thu chi (survey), kho, sản xuất, QC, lắp đặt, bảo hành.
-- Xưởng đã có cấu hình thì giữ nguyên, không ghi đè.
INSERT INTO "WorkshopPilotConfig" ("id", "organizationId", "active", "survey", "inventory", "shopFloor", "quality", "installation", "warranty", "version", "enabledAt", "updatedById", "updatedAt")
SELECT 'c' || substr(md5(o."id" || clock_timestamp()::text), 1, 24), o."id", true, true, true, true, true, true, true, 1, CURRENT_TIMESTAMP, 'system-migration', CURRENT_TIMESTAMP
FROM "Organization" o
WHERE o."type" = 'FACTORY'
  AND NOT EXISTS (SELECT 1 FROM "WorkshopPilotConfig" c WHERE c."organizationId" = o."id");
