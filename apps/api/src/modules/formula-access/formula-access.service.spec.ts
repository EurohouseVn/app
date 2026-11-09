import test from 'node:test';
import assert from 'node:assert/strict';
import { FormulaAccessService } from './formula-access.service';

function database() {
  const db: any = {
    organizations: [
      { id: 'npp-a', type: 'NPP', name: 'NPP A', managedByNppId: null },
      { id: 'npp-b', type: 'NPP', name: 'NPP B', managedByNppId: null },
      { id: 'factory-a', type: 'FACTORY', name: 'Xưởng A', managedByNppId: null },
    ],
    invites: [] as any[], grants: [] as any[], audits: [] as any[],
    users: [{ id: 'factory-user', role: 'FACTORY', organization: null, email: 'owner@example.com', emailNormalized: 'owner@example.com', phone: null, phoneNormalized: null, verifiedAt: null }],
  };
  const prisma: any = {
    user: {
      findMany: async ({ where }: any) => db.users.filter((row: any) => row.role === where.role && row.emailNormalized === where.emailNormalized && (!where.verifiedAt || row.verifiedAt !== null)).map((row: any) => ({ ...row, organization: db.organizations[2] ? { ...db.organizations[2], formulaAccessGrant: db.grants.find((grant: any) => grant.organizationId === db.organizations[2].id) ?? null } : null })),
    },
    organization: {
      findUnique: async ({ where }: any) => db.organizations.find((row: any) => row.id === where.id) ?? null,
      findMany: async () => db.organizations.filter((row: any) => row.type === 'FACTORY').map((row: any) => ({
        ...row,
        province: row.province ?? null,
        updatedAt: row.updatedAt ?? new Date('2026-11-08T10:00:00.000Z'),
        managedByNpp: db.organizations.find((candidate: any) => candidate.id === row.managedByNppId) ?? null,
        formulaAccessGrant: db.grants.find((grant: any) => grant.organizationId === row.id) ?? null,
      })),
      update: async ({ where, data }: any) => Object.assign(db.organizations.find((row: any) => row.id === where.id), data),
    },
    formulaInvite: {
      create: async ({ data }: any) => { const row = { id: `i${db.invites.length + 1}`, createdAt: new Date(), ...data }; db.invites.push(row); return row; },
      findUnique: async ({ where }: any) => db.invites.find((row: any) => row.codeHash === where.codeHash) ?? null,
      updateMany: async ({ where, data }: any) => {
        const row = db.invites.find((item: any) => item.id === where.id && item.status === where.status);
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => Object.assign(db.invites.find((row: any) => row.id === where.id), data),
    },
    formulaAccessGrant: {
      findUnique: async ({ where }: any) => db.grants.find((row: any) => row.organizationId === where.organizationId) ?? null,
      upsert: async ({ where, create, update }: any) => {
        let row = db.grants.find((item: any) => item.organizationId === where.organizationId);
        if (row) Object.assign(row, update); else { row = { id: `g${db.grants.length + 1}`, createdAt: new Date(), ...create }; db.grants.push(row); }
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(db.grants.find((row: any) => row.organizationId === where.organizationId), data),
    },
    formulaAccessAudit: { create: async ({ data }: any) => { const row = { id: `a${db.audits.length + 1}`, createdAt: new Date(), ...data }; db.audits.push(row); return row; } },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  return { db, prisma };
}

const nppActor = { userId: 'npp-user', role: 'NPP', organizationId: 'npp-a' } as const;
const factoryActor = { userId: 'factory-user', role: 'FACTORY', organizationId: 'factory-a' } as const;

test('invite is target-bound, expires after 30 days, stores only hash, and activates one organization grant', async () => {
  const { db, prisma } = database();
  const now = new Date('2026-11-08T10:00:00.000Z');
  const service = new FormulaAccessService(prisma, { now: () => now, randomCode: () => 'EH-ONE-TIME-CODE' });
  const created = await service.createInvite(nppActor, 'factory-a');

  assert.equal(created.plainCode, 'EH-ONE-TIME-CODE');
  assert.equal(JSON.stringify(db.invites).includes('EH-ONE-TIME-CODE'), false);
  assert.equal(db.invites[0].expiresAt.toISOString(), new Date(now.getTime() + 30 * 86_400_000).toISOString());
  assert.equal(db.invites[0].targetOrganizationId, 'factory-a');

  const view = await service.redeemInvite(factoryActor, created.plainCode);
  assert.equal(view.status, 'ACTIVE');
  assert.equal(db.organizations[2].managedByNppId, 'npp-a');
  assert.equal(db.grants.length, 1);
  assert.equal(db.audits.filter((row: any) => row.action === 'INVITE_REDEEMED').length, 1);
  await assert.rejects(() => service.redeemInvite(factoryActor, created.plainCode), /INVITE_USED/);
});

test('NPP cannot claim a factory already managed by another NPP and failure makes no partial writes', async () => {
  const { db, prisma } = database();
  db.organizations[2].managedByNppId = 'npp-b';
  const service = new FormulaAccessService(prisma);
  await assert.rejects(() => service.activateDirect(nppActor, 'factory-a'), /TRANSFER_REQUIRES_ADMIN/);
  assert.equal(db.grants.length, 0);
  assert.equal(db.audits.length, 0);
  assert.equal(db.organizations[2].managedByNppId, 'npp-b');
});

test('two concurrent redeems yield one ACTIVE grant and one redemption audit', async () => {
  const { db, prisma } = database();
  const service = new FormulaAccessService(prisma, { randomCode: () => 'EH-RACE-CODE' });
  const { plainCode } = await service.createInvite(nppActor, 'factory-a');
  const outcomes = await Promise.allSettled([
    service.redeemInvite(factoryActor, plainCode),
    service.redeemInvite(factoryActor, plainCode),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter((result) => result.status === 'rejected' && /INVITE_USED/.test(String(result.reason))).length, 1);
  assert.equal(db.grants.filter((row: any) => row.status === 'ACTIVE').length, 1);
  assert.equal(db.audits.filter((row: any) => row.action === 'INVITE_REDEEMED').length, 1);
});

test('admin list includes factories without a grant as LOCKED and internal staff can manage grants', async () => {
  const { db, prisma } = database();
  const service = new FormulaAccessService(prisma);
  const rows = await service.adminList({ status: 'LOCKED' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organizationId, 'factory-a');
  assert.equal(rows[0].status, 'LOCKED');

  const staffActor = { userId: 'staff-user', role: 'STAFF' } as const;
  await assert.rejects(() => service.activateDirect(staffActor, 'factory-a', 'factory-a'), /NPP_ORGANIZATION_REQUIRED/);
  await service.activateDirect(staffActor, 'factory-a', 'npp-a');
  await assert.rejects(() => service.transferNpp(staffActor, 'factory-a', 'factory-a', 'Không hợp lệ'), /NPP_ORGANIZATION_REQUIRED/);
  await service.transferNpp(staffActor, 'factory-a', 'npp-b', 'Chuyển vùng phụ trách');
  assert.equal(db.organizations[2].managedByNppId, 'npp-b');
  await service.revoke(staffActor, 'factory-a', 'Tạm dừng theo yêu cầu');
  assert.equal(db.grants[0].status, 'REVOKED');
});

test('NPP exact-identity search never exposes an unverified workshop', async () => {
  const { db, prisma } = database();
  const service = new FormulaAccessService(prisma);
  assert.deepEqual(await service.searchAccounts(nppActor, 'owner@example.com'), []);
  db.users[0].verifiedAt = new Date();
  assert.equal((await service.searchAccounts(nppActor, 'owner@example.com')).length, 1);
});

test('legacy customer lifecycle delegates Formula cutting to the generic Eurohouse service', async () => {
  const { prisma } = database();
  const calls: string[] = [];
  const genericView: any = {
    organizationId: 'factory-a',
    nppOrganizationId: 'npp-a',
    features: {
      FORMULA_CUTTING: {
        featureKey: 'FORMULA_CUTTING',
        status: 'ACTIVE',
        enabled: true,
        message: 'Công thức Eurohouse đã được kích hoạt',
      },
      EUROHOUSE_ORDERING: {
        featureKey: 'EUROHOUSE_ORDERING',
        status: 'LOCKED',
        enabled: false,
        message: 'locked',
      },
    },
  };
  const generic: any = {
    getCapability: async (_organizationId: string, featureKey: string) => {
      calls.push(`capability:${featureKey}`);
      return {
        featureKey,
        status: 'ACTIVE',
        enabled: true,
        message: 'Công thức Eurohouse đã được kích hoạt',
      };
    },
    getAccessView: async (organizationId: string) => {
      calls.push('view');
      return { ...genericView, organizationId };
    },
    createInvite: async () => {
      calls.push('create:FORMULA_CUTTING');
      return {
        plainCode: 'EH-COMPAT',
        invite: {
          id: 'invite-compat', codePrefix: 'EH-CO', codeLast4: 'MPAT', status: 'ACTIVE',
          featureKeys: ['FORMULA_CUTTING'], expiresAt: '2026-12-09T00:00:00.000Z',
          createdAt: '2026-11-09T00:00:00.000Z', targetOrganizationId: 'factory-a',
        },
      };
    },
    redeemInvite: async () => { calls.push('redeem'); return genericView; },
    activateFeature: async () => { calls.push('activate:FORMULA_CUTTING'); return genericView; },
    revokeFeature: async () => { calls.push('revoke:FORMULA_CUTTING'); return genericView; },
    transferNpp: async () => { calls.push('transfer'); return genericView; },
  };
  const service = new FormulaAccessService(prisma, undefined, generic);

  assert.deepEqual(await service.getCapability('factory-a'), {
    status: 'ACTIVE',
    enabled: true,
    message: 'Công thức Eurohouse đã được kích hoạt',
  });
  assert.equal((await service.getAccessView('factory-a')).status, 'ACTIVE');
  assert.equal((await service.createInvite(nppActor, 'factory-a')).plainCode, 'EH-COMPAT');
  await service.redeemInvite(factoryActor, 'EH-COMPAT');
  await service.activateDirect(nppActor, 'factory-a');
  await service.revoke(nppActor, 'factory-a', 'Dừng');
  await service.transferNpp({ userId: 'admin', role: 'ADMIN' }, 'factory-a', 'npp-b', 'Chuyển');
  assert.deepEqual(calls, [
    'capability:FORMULA_CUTTING',
    'view',
    'create:FORMULA_CUTTING',
    'redeem',
    'activate:FORMULA_CUTTING',
    'revoke:FORMULA_CUTTING',
    'transfer',
  ]);
});
