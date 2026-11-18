import type { PrismaClient } from '@prisma/client';
import { MANAGED_TRUOT_FORMULAS } from './managed-truot-formulas.data';

export async function seedManagedTruotFormulas(prisma: PrismaClient, options: { overwriteExisting?: boolean } = {}) {
  const system = await prisma.aluSystem.findUnique({ where: { code: 'EU-TRUOT' } });
  if (!system) throw new Error('Cannot seed managed Ecento formulas: EU-TRUOT system is missing.');

  const requiredCodes = [...new Set(MANAGED_TRUOT_FORMULAS.flatMap((definition) => definition.cutRules.map((rule) => rule.profileCode)))];
  const profiles = await prisma.profile.findMany({
    where: { code: { in: requiredCodes }, aluSystemId: system.id },
    select: { code: true },
  });
  const available = new Set(profiles.map((profile) => profile.code));
  const missing = requiredCodes.filter((code) => !available.has(code));
  if (missing.length) throw new Error(`Cannot seed managed Ecento formulas. Missing EU-TRUOT profiles: ${missing.join(', ')}`);

  for (const definition of MANAGED_TRUOT_FORMULAS) {
    const existing = await prisma.systemFormula.findUnique({ where: { stableKey: definition.stableKey } });
    if (existing) {
      if (options.overwriteExisting === false && existing.revision >= definition.revision) continue;
      await prisma.$transaction([
        prisma.doorModel.update({
          where: { id: existing.doorModelId },
          data: { name: definition.name, type: definition.type, description: definition.description, source: 'EUROHOUSE_ADMIN', active: true },
        }),
        prisma.systemFormula.update({
          where: { id: existing.id },
          data: {
            aluSystemId: system.id,
            inputSchema: definition.inputFields,
            cutRules: definition.cutRules,
            glassRules: definition.glassRules,
            sourceRef: definition.sourceRef,
            verificationStatus: definition.verificationStatus,
            status: 'PUBLISHED',
            revision: definition.revision,
            publishedAt: existing.publishedAt ?? new Date(),
          },
        }),
      ]);
      continue;
    }

    await prisma.doorModel.create({
      data: {
        name: definition.name,
        type: definition.type,
        description: definition.description,
        source: 'EUROHOUSE_ADMIN',
        active: true,
        systemFormulas: {
          create: {
            stableKey: definition.stableKey,
            aluSystemId: system.id,
            inputSchema: definition.inputFields,
            cutRules: definition.cutRules,
            glassRules: definition.glassRules,
            sourceRef: definition.sourceRef,
            verificationStatus: definition.verificationStatus,
            status: 'PUBLISHED',
            revision: definition.revision,
            publishedAt: new Date(),
          },
        },
      },
    });
  }

  return MANAGED_TRUOT_FORMULAS.length;
}
