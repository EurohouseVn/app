const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const SOURCE_HASH = '3C3464821B13F52E472815DA566475AC0856A176DFE04123418C44E42BD460C5';

async function main() {
  const existing = await prisma.technicalSource.findFirst({ where: { sourceHash: SOURCE_HASH } });
  if (existing) {
    console.log(JSON.stringify({ action: 'existing', id: existing.id, reviewState: existing.reviewState }, null, 2));
    return;
  }

  const actor = await prisma.user.findFirst({
    where: { role: 'ADMIN', isCeo: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, organizationId: true },
  });
  if (!actor) throw new Error('A CEO Admin account is required to register the technical source.');

  const source = await prisma.$transaction(async (tx) => {
    const created = await tx.technicalSource.create({
      data: {
        sourceType: 'OFFICIAL_CATALOGUE',
        sourceDocument: 'EUROHOUSE CATALOG R18',
        sourceRevision: 'R18 / 2026-08-01',
        sourcePage: '2-15',
        sourceHash: SOURCE_HASH,
        sourceDate: new Date('2026-08-01T00:00:00.000Z'),
        technicalOwner: '',
        ownerOrganizationId: actor.organizationId,
        reviewState: 'UNREVIEWED',
        enteredById: actor.id,
        notes: 'Supports profile codes, cross-sections, nominal thickness and kg/m where printed. Does not independently approve cutting deductions, machining, glass, gasket or hardware rules.',
        metadata: {
          fileName: 'EUROHOUSE CATALOG R18  010826-PRINT (16PAGE)-compressed.pdf',
          pageCount: 16,
          fileSizeBytes: 3711362,
          ingestionScope: ['PROFILE_IDENTITY', 'PROFILE_SECTION', 'NOMINAL_THICKNESS', 'KG_PER_METER'],
          excludedScope: ['CUTTING_DEDUCTION', 'MACHINING', 'GLASS_RULE', 'GASKET_RULE', 'HARDWARE_RULE'],
        },
      },
    });
    await tx.technicalReviewEvent.create({
      data: {
        entityType: 'TECHNICAL_SOURCE',
        entityId: created.id,
        action: 'CREATE',
        toStatus: 'UNREVIEWED',
        actorId: actor.id,
        notes: 'Catalog registered for technical review; no engineering approval inferred.',
      },
    });
    return created;
  });
  console.log(JSON.stringify({ action: 'created', id: source.id, reviewState: source.reviewState }, null, 2));
}

main().finally(() => prisma.$disconnect());
