-- Mỗi xưởng (cơ sở FACTORY) có cấu hình thí điểm riêng, độc lập với xưởng khác.
-- Xưởng đã tồn tại mà chưa có cấu hình được bật nhóm lõi `survey` (công trình, thu chi, khách hàng, mặt bằng, ô cửa).
-- Xưởng đã có cấu hình thì giữ nguyên, không ghi đè. Các module kho, sản xuất, QC, lắp đặt, bảo hành vẫn tắt.
INSERT INTO "WorkshopPilotConfig" ("id", "organizationId", "active", "survey", "version", "enabledAt", "updatedById", "updatedAt")
SELECT 'c' || substr(md5(o."id" || clock_timestamp()::text), 1, 24), o."id", true, true, 1, CURRENT_TIMESTAMP, 'system-migration', CURRENT_TIMESTAMP
FROM "Organization" o
WHERE o."type" = 'FACTORY'
  AND NOT EXISTS (SELECT 1 FROM "WorkshopPilotConfig" c WHERE c."organizationId" = o."id");
