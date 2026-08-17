const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const r18Systems = [
  { code: 'EU-ECPLUS', name: 'Hệ Ecento Plus', description: 'Cửa đi & cửa sổ dòng Ecento Plus', sortOrder: 9 },
  { code: 'EU-PDH', name: 'Hệ phào đại hội', description: 'Phào trang trí đại hội', sortOrder: 10 },
  { code: 'EU-MD', name: 'Hệ mặt dựng', description: 'Mặt dựng nhôm kính', sortOrder: 11 },
];

const r18Profiles = [
  ['EU-ECPLUS', 'C3328P', 'Khung bao liền phào', 1.179, 2],
  ['EU-ECPLUS', 'C3328-1.4', 'Khung phẳng', 0.948, 4],
  ['EU-ECPLUS', 'EPK116', 'Khung ôm tường Ecento Plus', 1.553, 2],
  ['EU-ECPLUS', 'EPD98', 'Cánh cửa đi', 1.363, 2],
  ['EU-ECPLUS', 'EPS78', 'Cánh cửa sổ', 1.127, 2],
  ['EU-ECPLUS', 'EPTD80', 'Đố cánh', 1.008, 2],
  ['EU-ECPLUS', 'C3323-ND', 'Đố động dùng chung', 0.789, 4],
  ['EU-ECPLUS', 'C3313', 'Đố khung', 0.899, 4],
  ['EU-ECPLUS', 'C3329A', 'Ốp chân cánh', 0.458, 10],
  ['EU-ECPLUS', 'C3296', 'Nẹp kính vách', 0.237, 10],
  ['EU-ECPLUS', 'EPS78S', 'Cánh cửa sổ sập rời', 1.012, 4],
  ['EU-ECPLUS', 'EPD98S', 'Cánh cửa đi sập rời', 1.275, 2],
  ['EU-ECPLUS', 'E70SH', 'Sập kính thường', 0.266, 10],
  ['EU-ECPLUS', 'T9809', 'Sập kính hộp', 0.214, 10],
  ['EU-ECPLUS', 'EPD138', 'Cánh cửa đi 138', 1.817, 1],
  ['EU-ECPLUS', 'EPD125P', 'Cánh cửa đi liền phào 125', 1.525, 2],
  ['EU-ECPLUS', 'EPS20-125', 'Nẹp kính hộp 20mm', 0.311, 10],
  ['EU-ECPLUS', 'EPS12-125', 'Nẹp kính 12mm', 0.343, 10],
  ['EU-ECPLUS', 'EPD138P', 'Cánh liền phào 138', 2.113, 1],
  ['EU-ECPLUS', 'EPSV11', 'Sập vách phẳng', 0.338, 10],
  ['EU-ECPLUS', 'EPT90', 'Đố khung bản 90mm', 1.331, 2],
  ['EU-PDH', 'DH01', 'Khung chính (Phào đại PĐ01)', 1.423, 1],
  ['EU-PDH', 'DH02', 'Cột phụ (Phào đại PĐ02)', 0.361, 10],
  ['EU-PDH', 'DH03', 'Đế ốp (Phào đại PĐ03)', 0.228, 10],
  ['EU-PDH', 'DH04', 'Cột chính ghép pano', 0.606, 10],
  ['EU-PDH', 'DH05', 'Cột phụ cải tiến', 0.439, 10],
  ['EU-PDH', 'KH01CT', 'Phào đỉnh', 0.69, 4],
  ['EU-PDH', 'EPV01', 'Phào nối đỉnh', 0.348, 10],
  ['EU-PDH', 'ECS21-P100', 'Phào nóc 100mm', 1.076, 5],
  ['EU-PDH', 'KH10', 'Thanh ngang', 0.497, 5],
  ['EU-PDH', 'ECS18', 'Phào cân', 0.344, 10],
  ['EU-PDH', 'KH09', 'U16', 0.13, 10],
  ['EU-MD', 'EMD6577', 'Mặt dựng 65x77', 1.615, 2],
  ['EU-MD', 'EMD65100', 'Mặt dựng 65x100', 2.245, 2],
  ['EU-MD', 'EMD65120', 'Mặt dựng 65x120', 2.106, 2],
  ['EU-MD', 'EMDK46', 'Khung mặt dựng 46', 0.75, 5],
  ['EU-MD', 'EMDS38', 'Cánh cửa sổ mặt dựng', 0.8, 10],
];

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "actualKgPerBar" DOUBLE PRECISION NOT NULL DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "theoreticalTotalKg" DOUBLE PRECISION NOT NULL DEFAULT 0');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key"');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode")');
  await prisma.$executeRawUnsafe('UPDATE "Profile" SET "actualKgPerBar" = ROUND(("kgPerMeter" * ("barLengthMm"::DOUBLE PRECISION / 1000.0))::numeric, 3)::DOUBLE PRECISION WHERE "actualKgPerBar" = 0');
  await prisma.$executeRawUnsafe('UPDATE "OrderItem" SET "theoreticalTotalKg" = "totalKg" WHERE "theoreticalTotalKg" = 0');

  const systemIdByCode = new Map();
  for (const system of r18Systems) {
    const saved = await prisma.aluSystem.upsert({
      where: { code: system.code },
      update: {
        name: system.name,
        description: system.description,
        sortOrder: system.sortOrder,
      },
      create: system,
    });
    systemIdByCode.set(system.code, saved.id);
  }

  for (const [systemCode, code, name, kgPerMeter, barsPerBundle] of r18Profiles) {
    const aluSystemId = systemIdByCode.get(systemCode);
    await prisma.profile.upsert({
      where: { aluSystemId_code: { aluSystemId, code } },
      update: {
        name,
        kgPerMeter,
        actualKgPerBar: Number((kgPerMeter * 6).toFixed(3)),
        barsPerBundle,
        barLengthMm: 6000,
        imageUrl: `/static/profiles/${code}.png`,
      },
      create: {
        aluSystemId,
        code,
        name,
        kgPerMeter,
        actualKgPerBar: Number((kgPerMeter * 6).toFixed(3)),
        barsPerBundle,
        barLengthMm: 6000,
        pricePerKg: 92000,
        imageUrl: `/static/profiles/${code}.png`,
      },
    });
  }

  await prisma.profile.updateMany({
    where: { code: 'ECS18-2' },
    data: {
      name: 'Phào cân (biến thể 2)',
      kgPerMeter: 0.344,
      actualKgPerBar: Number((0.344 * 6).toFixed(3)),
      imageUrl: '/static/profiles/ECS18-2.png',
    },
  });
}

main()
  .catch((error) => {
    console.error('Failed to ensure runtime database schema.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
