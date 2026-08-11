const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "NppProfileStock" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('ALTER TABLE "NppStockMovement" ADD COLUMN IF NOT EXISTS "colorCode" TEXT NOT NULL DEFAULT \'\'');
  await prisma.$executeRawUnsafe('DROP INDEX IF EXISTS "NppProfileStock_nppOrgId_profileId_key"');
  await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX IF NOT EXISTS "NppProfileStock_nppOrgId_profileId_colorCode_key" ON "NppProfileStock"("nppOrgId", "profileId", "colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppProfileStock_colorCode_idx" ON "NppProfileStock"("colorCode")');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "NppStockMovement_colorCode_idx" ON "NppStockMovement"("colorCode")');
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
