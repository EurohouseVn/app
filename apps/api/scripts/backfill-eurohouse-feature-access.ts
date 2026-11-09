import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

export type EurohouseFeatureBackfillMode = 'dry-run' | 'apply';
export type EurohouseFeatureBackfillOptions = { mode: EurohouseFeatureBackfillMode };

type LegacyFormulaGrant = {
  id: string;
  organizationId: string;
  status: 'ACTIVE' | 'REVOKED';
  nppOrganizationId?: string | null;
  source: string;
  activatedByUserId: string;
  activatedAt: Date;
  revokedByUserId?: string | null;
  revokedAt?: Date | null;
  revokeReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CurrentFormulaGrant = {
  organizationId: string;
  featureKey: 'FORMULA_CUTTING';
  nppOrganizationId?: string | null;
};

export type EurohouseFeatureBackfillConflict = {
  organizationId: string;
  legacyNppOrganizationId: string;
  currentNppOrganizationId: string;
};

export type EurohouseFeatureBackfillResult = {
  examinedLegacyRows: number;
  uniqueFormulaOrganizations: number;
  duplicateLegacyRows: number;
  plannedFormulaMigrations: number;
  appliedFormulaMigrations: number;
  skippedExisting: number;
  activeFormulaMigrations: number;
  revokedFormulaMigrations: number;
  orderingActivations: 0;
  conflicts: EurohouseFeatureBackfillConflict[];
};

function newestLegacyGrant(rows: LegacyFormulaGrant[]) {
  return [...rows].sort((left, right) =>
    right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id),
  )[0];
}

export async function runEurohouseFeatureAccessBackfill(
  prisma: any,
  options: EurohouseFeatureBackfillOptions,
): Promise<EurohouseFeatureBackfillResult> {
  const legacyRows = await prisma.formulaAccessGrant.findMany({
    orderBy: [{ organizationId: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }],
  }) as LegacyFormulaGrant[];
  const currentRows = await prisma.eurohouseFeatureGrant.findMany({
    where: { featureKey: 'FORMULA_CUTTING' },
  }) as CurrentFormulaGrant[];

  const grouped = new Map<string, LegacyFormulaGrant[]>();
  for (const row of legacyRows) {
    const rows = grouped.get(row.organizationId) ?? [];
    rows.push(row);
    grouped.set(row.organizationId, rows);
  }
  const currentByOrganization = new Map(currentRows.map((row) => [row.organizationId, row]));
  const conflicts: EurohouseFeatureBackfillConflict[] = [];
  const candidates: LegacyFormulaGrant[] = [];
  let skippedExisting = 0;

  for (const organizationId of [...grouped.keys()].sort()) {
    const legacy = newestLegacyGrant(grouped.get(organizationId)!);
    const current = currentByOrganization.get(organizationId);
    if (!current) {
      candidates.push(legacy);
      continue;
    }
    if (
      legacy.nppOrganizationId &&
      current.nppOrganizationId &&
      legacy.nppOrganizationId !== current.nppOrganizationId
    ) {
      conflicts.push({
        organizationId,
        legacyNppOrganizationId: legacy.nppOrganizationId,
        currentNppOrganizationId: current.nppOrganizationId,
      });
      continue;
    }
    skippedExisting += 1;
  }

  let appliedFormulaMigrations = 0;
  if (options.mode === 'apply' && conflicts.length === 0) {
    for (const legacy of candidates) {
      await prisma.$transaction(async (tx: any) => {
        await tx.eurohouseFeatureGrant.create({
          data: {
            organizationId: legacy.organizationId,
            featureKey: 'FORMULA_CUTTING',
            status: legacy.status,
            nppOrganizationId: legacy.nppOrganizationId ?? null,
            source: 'MIGRATED',
            activatedByUserId: legacy.activatedByUserId,
            activatedAt: legacy.activatedAt,
            revokedByUserId: legacy.revokedByUserId ?? null,
            revokedAt: legacy.revokedAt ?? null,
            revokeReason: legacy.revokeReason ?? null,
            createdAt: legacy.createdAt,
            updatedAt: legacy.updatedAt,
          },
        });
      });
      appliedFormulaMigrations += 1;
    }
  }

  return {
    examinedLegacyRows: legacyRows.length,
    uniqueFormulaOrganizations: grouped.size,
    duplicateLegacyRows: legacyRows.length - grouped.size,
    plannedFormulaMigrations: candidates.length,
    appliedFormulaMigrations,
    skippedExisting,
    activeFormulaMigrations: candidates.filter((row) => row.status === 'ACTIVE').length,
    revokedFormulaMigrations: candidates.filter((row) => row.status === 'REVOKED').length,
    orderingActivations: 0,
    conflicts,
  };
}

async function main() {
  const mode: EurohouseFeatureBackfillMode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const prisma = new PrismaClient();
  try {
    const result = await runEurohouseFeatureAccessBackfill(prisma, { mode });
    process.stdout.write(`${JSON.stringify({ mode, ...result }, null, 2)}\n`);
    if (result.conflicts.length > 0) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
