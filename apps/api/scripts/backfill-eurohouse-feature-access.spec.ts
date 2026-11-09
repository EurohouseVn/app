import test from 'node:test';
import assert from 'node:assert/strict';
import { runEurohouseFeatureAccessBackfill } from './backfill-eurohouse-feature-access';

function fixture() {
  const legacy = [
    {
      id: 'legacy-active-a', organizationId: 'factory-a', status: 'ACTIVE',
      nppOrganizationId: 'npp-a', source: 'NPP_INVITE', activatedByUserId: 'user-a',
      activatedAt: new Date('2026-10-01T00:00:00.000Z'), revokedByUserId: null,
      revokedAt: null, revokeReason: null, createdAt: new Date('2026-10-01T00:00:00.000Z'),
      updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    },
    {
      id: 'legacy-active-a-duplicate', organizationId: 'factory-a', status: 'ACTIVE',
      nppOrganizationId: 'npp-a', source: 'NPP_INVITE', activatedByUserId: 'user-a',
      activatedAt: new Date('2026-10-02T00:00:00.000Z'), revokedByUserId: null,
      revokedAt: null, revokeReason: null, createdAt: new Date('2026-10-02T00:00:00.000Z'),
      updatedAt: new Date('2026-10-02T00:00:00.000Z'),
    },
    {
      id: 'legacy-revoked-b', organizationId: 'factory-b', status: 'REVOKED',
      nppOrganizationId: 'npp-a', source: 'NPP_DIRECT', activatedByUserId: 'user-b',
      activatedAt: new Date('2026-09-01T00:00:00.000Z'), revokedByUserId: 'admin-1',
      revokedAt: new Date('2026-10-03T00:00:00.000Z'), revokeReason: 'Dừng hợp tác',
      createdAt: new Date('2026-09-01T00:00:00.000Z'), updatedAt: new Date('2026-10-03T00:00:00.000Z'),
    },
    {
      id: 'legacy-conflict-c', organizationId: 'factory-c', status: 'ACTIVE',
      nppOrganizationId: 'npp-a', source: 'NPP_DIRECT', activatedByUserId: 'user-c',
      activatedAt: new Date('2026-09-01T00:00:00.000Z'), revokedByUserId: null,
      revokedAt: null, revokeReason: null, createdAt: new Date('2026-09-01T00:00:00.000Z'),
      updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    },
  ];
  const grants: any[] = [{
    id: 'current-c', organizationId: 'factory-c', featureKey: 'FORMULA_CUTTING',
    status: 'ACTIVE', nppOrganizationId: 'npp-b', source: 'ADMIN_DIRECT',
    activatedByUserId: 'admin-2', activatedAt: new Date('2026-11-01T00:00:00.000Z'),
  }];
  const prisma: any = {
    formulaAccessGrant: { findMany: async () => legacy },
    eurohouseFeatureGrant: {
      findMany: async () => grants,
      create: async ({ data }: any) => {
        const row = { id: `new-${data.organizationId}`, ...data };
        grants.push(row);
        return row;
      },
    },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  return { prisma, legacy, grants };
}

test('dry-run deduplicates legacy rows, preserves statuses, reports cross-NPP conflicts and never activates ordering', async () => {
  const { prisma, grants } = fixture();
  const result = await runEurohouseFeatureAccessBackfill(prisma, { mode: 'dry-run' });

  assert.deepEqual(result, {
    examinedLegacyRows: 4,
    uniqueFormulaOrganizations: 3,
    duplicateLegacyRows: 1,
    plannedFormulaMigrations: 2,
    appliedFormulaMigrations: 0,
    skippedExisting: 0,
    activeFormulaMigrations: 1,
    revokedFormulaMigrations: 1,
    orderingActivations: 0,
    conflicts: [{ organizationId: 'factory-c', legacyNppOrganizationId: 'npp-a', currentNppOrganizationId: 'npp-b' }],
  });
  assert.equal(grants.length, 1);
  assert.equal(grants.some((row) => row.featureKey === 'EUROHOUSE_ORDERING'), false);
});

test('apply preserves formula status and revoke provenance, and a second run is idempotent', async () => {
  const { prisma, grants } = fixture();
  grants[0].nppOrganizationId = 'npp-a';
  const first = await runEurohouseFeatureAccessBackfill(prisma, { mode: 'apply' });
  assert.equal(first.appliedFormulaMigrations, 2);

  const active = grants.find((row) => row.organizationId === 'factory-a');
  const revoked = grants.find((row) => row.organizationId === 'factory-b');
  assert.equal(active.featureKey, 'FORMULA_CUTTING');
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.nppOrganizationId, 'npp-a');
  assert.equal(revoked.status, 'REVOKED');
  assert.equal(revoked.revokedByUserId, 'admin-1');
  assert.equal(revoked.revokeReason, 'Dừng hợp tác');
  assert.equal(grants.some((row) => row.featureKey === 'EUROHOUSE_ORDERING'), false);

  const second = await runEurohouseFeatureAccessBackfill(prisma, { mode: 'apply' });
  assert.equal(second.appliedFormulaMigrations, 0);
  assert.equal(second.skippedExisting, 3);
  assert.equal(grants.filter((row) => row.featureKey === 'FORMULA_CUTTING').length, 3);
});

test('apply fails closed when the review set still contains an NPP ownership conflict', async () => {
  const { prisma, grants } = fixture();
  const result = await runEurohouseFeatureAccessBackfill(prisma, { mode: 'apply' });
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.appliedFormulaMigrations, 0);
  assert.equal(grants.length, 1);
});
