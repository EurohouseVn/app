import { PrismaClient } from '@prisma/client';
import { seedManagedTqFormulas } from '../prisma/seed-managed-tq';

const prisma = new PrismaClient();

seedManagedTqFormulas(prisma, { overwriteExisting: !process.argv.includes('--create-only') })
  .then((count) => console.log(`Seeded ${count} managed EU-TQ formulas.`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
