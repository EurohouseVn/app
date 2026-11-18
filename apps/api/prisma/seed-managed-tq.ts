import type { PrismaClient } from '@prisma/client';
import { MANAGED_TQ_FORMULAS } from './managed-tq-formulas.data';

export async function seedManagedTqFormulas(prisma: PrismaClient, options: { overwriteExisting?: boolean } = {}) {
  const system = await prisma.aluSystem.findUnique({ where: { code: 'EU-TQ' } });
  if (!system) throw new Error('Cannot seed managed EU-TQ formulas: EU-TQ system is missing.');

  const requiredProfiles = [...new Map(
    MANAGED_TQ_FORMULAS.flatMap((definition) => definition.cutRules).map((rule) => {
      const systemCode = rule.profileSystemCode ?? 'EU-TQ';
      return [`${systemCode}:${rule.profileCode}`, { systemCode, profileCode: rule.profileCode }] as const;
    }),
  ).values()];
  const profiles = await prisma.profile.findMany({
    where: {
      OR: requiredProfiles.map((item) => ({
        code: item.profileCode,
        aluSystem: { code: item.systemCode },
      })),
    },
    select: { code: true, aluSystem: { select: { code: true } } },
  });
  const availableProfiles = new Set(profiles.map((profile) => `${profile.aluSystem.code}:${profile.code}`));
  const missingProfiles = requiredProfiles.filter((item) => !availableProfiles.has(`${item.systemCode}:${item.profileCode}`));
  if (missingProfiles.length) {
    throw new Error(`Cannot seed managed EU-TQ formulas. Missing profiles: ${missingProfiles.map((item) => `${item.systemCode}/${item.profileCode}`).join(', ')}`);
  }

  for (const definition of MANAGED_TQ_FORMULAS) {
    const existing = await prisma.systemFormula.findUnique({ where: { stableKey: definition.stableKey } });
    if (existing) {
      // Production uses create-only mode. It may still apply a newer official
      // revision, but never overwrites a formula that Admin has already edited
      // to the same or a newer revision.
      if (options.overwriteExisting === false && existing.revision >= definition.revision) continue;
      await prisma.$transaction([
        prisma.doorModel.update({
          where: { id: existing.doorModelId },
          data: {
            name: definition.name,
            type: definition.type,
            description: definition.description,
            source: 'EUROHOUSE_ADMIN',
            active: true,
          },
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

  return MANAGED_TQ_FORMULAS.length;
}
