import { pathToFileURL } from 'node:url';
import { PrismaClient } from '@prisma/client';

type BackfillMode = 'dry-run' | 'apply';
type BackfillOptions = { mode: BackfillMode; now?: Date };
type LegacyUser = { id: string; role?: string; moduleAccess?: string | null };
type LegacyOrganization = {
  id: string;
  managedByNppId?: string | null;
  users: LegacyUser[];
  formulaAccessGrant?: { nppOrganizationId?: string | null } | null;
};

export type FormulaAccessBackfillResult = {
  examined: number;
  eligible: number;
  planned: number;
  applied: number;
  skipped: number;
  conflicts: string[];
};

function modules(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function migrationActor(users: LegacyUser[]) {
  return [...users].sort((a, b) => {
    const aFormula = modules(a.moduleAccess).includes('factory:formulas') ? 0 : 1;
    const bFormula = modules(b.moduleAccess).includes('factory:formulas') ? 0 : 1;
    return aFormula - bFormula || a.id.localeCompare(b.id);
  })[0];
}

export async function runFormulaAccessBackfill(prisma: any, options: BackfillOptions): Promise<FormulaAccessBackfillResult> {
  const now = options.now ?? new Date();
  const organizations = await prisma.organization.findMany({
    where: { type: 'FACTORY' },
    include: { users: { select: { id: true, role: true, moduleAccess: true } }, formulaAccessGrant: true },
    orderBy: { id: 'asc' },
  }) as LegacyOrganization[];

  const result: FormulaAccessBackfillResult = { examined: organizations.length, eligible: 0, planned: 0, applied: 0, skipped: 0, conflicts: [] };
  for (const organization of organizations) {
    const hasLegacyModule = organization.users.some((user) => modules(user.moduleAccess).includes('factory:formulas'));
    const eligible = Boolean(organization.managedByNppId || hasLegacyModule);
    if (!eligible) { result.skipped += 1; continue; }
    result.eligible += 1;

    const existing = organization.formulaAccessGrant;
    if (existing) {
      if (organization.managedByNppId && existing.nppOrganizationId && organization.managedByNppId !== existing.nppOrganizationId) {
        result.conflicts.push(organization.id);
      } else {
        result.skipped += 1;
      }
      continue;
    }

    const actor = migrationActor(organization.users);
    if (!actor) { result.conflicts.push(`${organization.id}:NO_ACTOR`); continue; }
    result.planned += 1;
    if (options.mode === 'dry-run') continue;

    await prisma.$transaction(async (tx: any) => {
      await tx.formulaAccessGrant.create({
        data: {
          organizationId: organization.id,
          status: 'ACTIVE',
          nppOrganizationId: organization.managedByNppId ?? null,
          source: 'MIGRATED',
          activatedByUserId: actor.id,
          activatedAt: now,
        },
      });
      await tx.formulaAccessAudit.create({
        data: {
          organizationId: organization.id,
          actorUserId: actor.id,
          actorRole: actor.role ?? 'FACTORY',
          action: 'DIRECT_ACTIVATED',
          toNppOrganizationId: organization.managedByNppId ?? null,
          metadata: { source: 'MIGRATED', legacyFormulaModule: hasLegacyModule },
          createdAt: now,
        },
      });
    });
    result.applied += 1;
  }
  return result;
}

async function main() {
  const mode: BackfillMode = process.argv.includes('--apply') ? 'apply' : 'dry-run';
  const prisma = new PrismaClient();
  try {
    const result = await runFormulaAccessBackfill(prisma, { mode });
    process.stdout.write(`${JSON.stringify({ mode, ...result }, null, 2)}\n`);
    if (result.conflicts.length) process.exitCode = 2;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main();
}
