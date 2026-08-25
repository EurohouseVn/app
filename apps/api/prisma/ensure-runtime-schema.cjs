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
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NppProfileStock" (
      "id" TEXT PRIMARY KEY,
      "nppOrgId" TEXT NOT NULL,
      "profileId" TEXT NOT NULL,
      "colorCode" TEXT NOT NULL DEFAULT '',
      "stockBars" INTEGER NOT NULL DEFAULT 0,
      "lowStockAlert" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NppStockMovement" (
      "id" TEXT PRIMARY KEY,
      "nppOrgId" TEXT NOT NULL,
      "profileId" TEXT NOT NULL,
      "colorCode" TEXT NOT NULL DEFAULT '',
      "direction" TEXT NOT NULL,
      "quantity" INTEGER NOT NULL,
      "reason" TEXT NOT NULL DEFAULT '',
      "orderId" TEXT,
      "createdById" TEXT,
      "note" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await prisma.$executeRawUnsafe('ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "Profile" DROP COLUMN IF EXISTS "actualKgPerBar"');
  await prisma.$executeRawUnsafe('ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "theoreticalTotalKg" DOUBLE PRECISION NOT NULL DEFAULT 0');
  await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT');
  await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "factoryOrgId" TEXT');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "Order_createdById_clientRequestId_key" ON "Order"("createdById", "clientRequestId")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Order_factoryOrgId_idx" ON "Order"("factoryOrgId")');
  await prisma.$executeRawUnsafe(`
    UPDATE "Order" AS orders
    SET "factoryOrgId" = users."organizationId"
    FROM "User" AS users
    JOIN "Organization" AS organizations ON organizations."id" = users."organizationId" AND organizations."type" = 'FACTORY'
    WHERE orders."createdById" = users."id" AND orders."factoryOrgId" IS NULL
  `);
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key"');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode")');
  await prisma.$executeRawUnsafe('UPDATE "OrderItem" SET "theoreticalTotalKg" = "totalKg" WHERE "theoreticalTotalKg" = 0');

  const quotationColumns = [
    'ADD COLUMN IF NOT EXISTS "createdById" TEXT',
    'ADD COLUMN IF NOT EXISTS "customerPhone" TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "customerAddress" TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "baseAmount" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "profitAmount" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "vatPct" DOUBLE PRECISION NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "vatAmount" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "extraProducts" TEXT',
    'ADD COLUMN IF NOT EXISTS "isFinalSettlement" BOOLEAN NOT NULL DEFAULT false',
    'ADD COLUMN IF NOT EXISTS "depositAmount" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
  ];
  for (const clause of quotationColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Quotation" ${clause}`);
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "QuotationItem" (
      "id" TEXT PRIMARY KEY,
      "quotationId" TEXT NOT NULL,
      "name" TEXT NOT NULL DEFAULT '',
      "system" TEXT NOT NULL DEFAULT '',
      "doorType" TEXT NOT NULL DEFAULT '',
      "templateId" TEXT,
      "widthMm" INTEGER NOT NULL DEFAULT 0,
      "heightMm" INTEGER NOT NULL DEFAULT 0,
      "wallHugging" TEXT NOT NULL DEFAULT 'Non',
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "includesAccessories" BOOLEAN NOT NULL DEFAULT true,
      "accessoriesPrice" INTEGER NOT NULL DEFAULT 0,
      "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "pricePerM2" INTEGER NOT NULL DEFAULT 0,
      "totalPrice" INTEGER NOT NULL DEFAULT 0,
      "color" TEXT,
      "glassType" TEXT,
      "glassColor" TEXT,
      "dynamicInputs" JSONB
    )
  `);
  const quotationItemColumns = [
    'ADD COLUMN IF NOT EXISTS "quotationId" TEXT',
    'ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "system" TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "doorType" TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS "templateId" TEXT',
    'ADD COLUMN IF NOT EXISTS "widthMm" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "heightMm" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "wallHugging" TEXT NOT NULL DEFAULT \'Non\'',
    'ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1',
    'ADD COLUMN IF NOT EXISTS "includesAccessories" BOOLEAN NOT NULL DEFAULT true',
    'ADD COLUMN IF NOT EXISTS "accessoriesPrice" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "areaM2" DOUBLE PRECISION NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "pricePerM2" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "totalPrice" INTEGER NOT NULL DEFAULT 0',
    'ADD COLUMN IF NOT EXISTS "color" TEXT',
    'ADD COLUMN IF NOT EXISTS "glassType" TEXT',
    'ADD COLUMN IF NOT EXISTS "glassColor" TEXT',
    'ADD COLUMN IF NOT EXISTS "dynamicInputs" JSONB',
    'ADD COLUMN IF NOT EXISTS "formulaSnapshot" JSONB',
  ];
  for (const clause of quotationItemColumns) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "QuotationItem" ${clause}`);
  }
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "Quotation_createdById_idx" ON "Quotation"("createdById")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId")');

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
        barsPerBundle,
        barLengthMm: 6000,
        imageUrl: `/static/profiles/${code}.png`,
      },
      create: {
        aluSystemId,
        code,
        name,
        kgPerMeter,
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
