import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

async function main() {
  const systems = await p.aluSystem.findMany({ orderBy: { sortOrder: 'asc' } });
  console.log('=== AluSystems ===');
  console.log(JSON.stringify(systems, null, 2));

  const designs = await p.doorModel.findMany();
  console.log('=== DoorModels ===');
  console.log(JSON.stringify(designs, null, 2));

  const formulas = await p.systemFormula.findMany({ include: { doorModel: true, aluSystem: true } });
  console.log('=== SystemFormulas ===');
  console.log(JSON.stringify(formulas, null, 2));

  // Also check old formulaTemplate system names
  const oldSystems = await p.formulaTemplate.groupBy({ by: ['systemName'], orderBy: { systemName: 'asc' } });
  console.log('=== Old FormulaTemplate systemNames ===');
  console.log(JSON.stringify(oldSystems, null, 2));
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
