import test from 'node:test';
import assert from 'node:assert/strict';
import { runFormulaAccessBackfill } from './backfill-formula-access-grants';

function fixture() {
  const organizations: any[] = [
    { id: 'npp-a', type: 'NPP', name: 'NPP A', managedByNppId: null, users: [] },
    { id: 'npp-b', type: 'NPP', name: 'NPP B', managedByNppId: null, users: [] },
    { id: 'linked', type: 'FACTORY', name: 'Xưởng liên kết', managedByNppId: 'npp-a', users: [{ id: 'u-linked', moduleAccess: '[]' }], formulaAccessGrant: null },
    { id: 'legacy', type: 'FACTORY', name: 'Xưởng cũ', managedByNppId: null, users: [{ id: 'u-legacy-a', moduleAccess: '["factory:formulas"]' }, { id: 'u-legacy-b', moduleAccess: '["factory:formulas"]' }], formulaAccessGrant: null },
    { id: 'public', type: 'FACTORY', name: 'Xưởng công khai', managedByNppId: null, users: [{ id: 'u-public', moduleAccess: '["factory:orders"]' }], formulaAccessGrant: null },
    { id: 'conflict', type: 'FACTORY', name: 'Xưởng xung đột', managedByNppId: 'npp-a', users: [{ id: 'u-conflict', moduleAccess: '["factory:formulas"]' }], formulaAccessGrant: { id: 'g-conflict', organizationId: 'conflict', nppOrganizationId: 'npp-b', status: 'ACTIVE', source: 'MIGRATED' } },
  ];
  const grants: any[] = [organizations[5].formulaAccessGrant];
  const audits: any[] = [];
  const prisma: any = {
    organization: { findMany: async () => organizations.filter((row) => row.type === 'FACTORY') },
    formulaAccessGrant: {
      create: async ({ data }: any) => { const row = { id: `g-${data.organizationId}`, ...data }; grants.push(row); organizations.find((item) => item.id === data.organizationId).formulaAccessGrant = row; return row; },
    },
    formulaAccessAudit: { create: async ({ data }: any) => { audits.push(data); return data; } },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  return { prisma, organizations, grants, audits };
}

test('dry-run plans linked/module legacy grants, skips public workshops, deduplicates users and reports ownership conflicts', async () => {
  const { prisma, grants, audits } = fixture();
  const result = await runFormulaAccessBackfill(prisma, { mode: 'dry-run', now: new Date('2026-11-08T10:00:00.000Z') });
  assert.deepEqual(result, { examined: 4, eligible: 3, planned: 2, applied: 0, skipped: 1, conflicts: ['conflict'] });
  assert.equal(grants.length, 1);
  assert.equal(audits.length, 0);
});

test('apply creates one MIGRATED/ACTIVE grant per eligible organization and a second run is idempotent', async () => {
  const { prisma, organizations, grants, audits } = fixture();
  const first = await runFormulaAccessBackfill(prisma, { mode: 'apply', now: new Date('2026-11-08T10:00:00.000Z') });
  assert.equal(first.applied, 2);
  assert.equal(grants.filter((grant) => grant.organizationId === 'legacy').length, 1);
  assert.equal(grants.find((grant) => grant.organizationId === 'linked').nppOrganizationId, 'npp-a');
  assert.equal(grants.find((grant) => grant.organizationId === 'legacy').nppOrganizationId, null);
  assert.ok(grants.filter((grant) => ['linked', 'legacy'].includes(grant.organizationId)).every((grant) => grant.status === 'ACTIVE' && grant.source === 'MIGRATED'));
  assert.equal(organizations.find((row) => row.id === 'legacy').managedByNppId, null);
  assert.equal(audits.length, 2);

  const second = await runFormulaAccessBackfill(prisma, { mode: 'apply', now: new Date('2026-11-08T10:00:00.000Z') });
  assert.equal(second.applied, 0);
  assert.equal(grants.length, 3);
  assert.equal(audits.length, 2);
});
