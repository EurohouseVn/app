import { PrismaClient } from '@prisma/client';
import { seedManagedTruotFormulas } from '../prisma/seed-managed-truot';

const prisma = new PrismaClient();

seedManagedTruotFormulas(prisma, { overwriteExisting: !process.argv.includes('--create-only') })
  .then((count) => console.log(`Seeded ${count} managed Ecento Châu Âu formulas.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
