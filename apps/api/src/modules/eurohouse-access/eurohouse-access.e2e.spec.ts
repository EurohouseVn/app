import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../../auth/auth.service';
import { CatalogService } from '../catalog/catalog.service';
import { OrdersService } from '../orders/orders.service';
import { EurohouseAccessService } from './eurohouse-access.service';

function releaseDatabase() {
  const now = new Date('2026-11-09T08:00:00.000Z');
  const db: any = {
    organizations: [
      { id: 'npp-a', code: 'NPP-A', name: 'NPP A', type: 'NPP', managedByNppId: null, province: 'Hà Nội' },
    ],
    users: [] as any[], invites: [] as any[], grants: [] as any[], audits: [] as any[],
    orders: [{ id: 'old-order', code: 'CSSX-OLD-01', status: 'DRAFT', createdById: 'factory-user', nppOrgId: 'npp-a', items: [], histories: [] }],
  };
  const prisma: any = {
    organization: {
      create: async ({ data }: any) => { const row = { id: `factory-${db.organizations.length}`, managedByNppId: null, ...data }; db.organizations.push(row); return row; },
      delete: async ({ where }: any) => { db.organizations = db.organizations.filter((row: any) => row.id !== where.id); },
      update: async ({ where, data }: any) => Object.assign(db.organizations.find((row: any) => row.id === where.id), data),
      findUnique: async ({ where }: any) => {
        const row = db.organizations.find((item: any) => item.id === where.id);
        if (!row) return null;
        return { ...row, managedByNpp: db.organizations.find((item: any) => item.id === row.managedByNppId) ?? null, eurohouseFeatureGrants: db.grants.filter((item: any) => item.organizationId === row.id) };
      },
    },
    user: {
      findFirst: async ({ where }: any) => db.users.find((row: any) =>
        where.organizationId
          ? row.organizationId === where.organizationId && row.verifiedAt !== null
          : where.OR?.some((identity: any) => identity.emailNormalized ? row.emailNormalized === identity.emailNormalized : row.phoneNormalized === identity.phoneNormalized),
      ) ?? null,
      findUnique: async ({ where }: any) => {
        const row = db.users.find((item: any) => item.id === where.id);
        if (!row) return null;
        return { isCeo: false, moduleAccess: '[]', jobTitle: '', departmentId: null, rbacRoleId: null, department: null, rbacRole: null, ...row, organization: db.organizations.find((item: any) => item.id === row.organizationId) };
      },
      create: async ({ data }: any) => { const row = { id: 'factory-user', isCeo: false, ...data }; db.users.push(row); return row; },
      update: async ({ where, data }: any) => Object.assign(db.users.find((row: any) => row.id === where.id), data),
      delete: async ({ where }: any) => { db.users = db.users.filter((row: any) => row.id !== where.id); },
    },
    eurohouseFeatureGrant: {
      findUnique: async ({ where }: any) => db.grants.find((row: any) => row.organizationId === where.organizationId_featureKey.organizationId && row.featureKey === where.organizationId_featureKey.featureKey) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = where.organizationId_featureKey;
        let row = db.grants.find((item: any) => item.organizationId === key.organizationId && item.featureKey === key.featureKey);
        if (row) Object.assign(row, update); else { row = { id: `grant-${db.grants.length + 1}`, ...create }; db.grants.push(row); }
        return row;
      },
      update: async ({ where, data }: any) => Object.assign(db.grants.find((row: any) => row.organizationId === where.organizationId_featureKey.organizationId && row.featureKey === where.organizationId_featureKey.featureKey), data),
      updateMany: async ({ where, data }: any) => { const rows = db.grants.filter((row: any) => row.organizationId === where.organizationId); rows.forEach((row: any) => Object.assign(row, data)); return { count: rows.length }; },
    },
    eurohouseInvite: {
      create: async ({ data }: any) => { const row = { id: `invite-${db.invites.length + 1}`, createdAt: now, ...data }; db.invites.push(row); return row; },
      findUnique: async ({ where }: any) => { const row = db.invites.find((item: any) => item.codeHash === where.codeHash); return row ? { ...row, nppOrganization: db.organizations[0] } : null; },
      updateMany: async ({ where, data }: any) => { const row = db.invites.find((item: any) => item.id === where.id && item.status === where.status); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; },
    },
    eurohouseAccessAudit: { create: async ({ data }: any) => { db.audits.push(data); return data; } },
    order: { findFirst: async ({ where }: any) => db.orders.find((row: any) => where.OR.some((key: any) => key.id === row.id || key.code === row.code)) ?? null },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };
  return { db, prisma, now };
}

test('guest discovery stays public and registration starts with formulas open and ordering locked', async () => {
  const catalog = new CatalogService({ aluSystem: { findMany: async () => [{ id: 'eu55', code: 'EU55', name: 'Hệ EU55', profiles: [] }] } } as never);
  assert.deepEqual(await catalog.catalog(), [{ id: 'eu55', code: 'EU55', name: 'Hệ EU55', description: undefined, profiles: [] }]);

  const { db, prisma, now } = releaseDatabase();
  const access = new EurohouseAccessService(prisma, { now: () => now });
  const auth = new AuthService(
    prisma,
    { signAsync: async () => 'jwt' } as never,
    { create: async () => ({ challengeId: 'challenge-1', expiresAt: now }) } as never,
    undefined,
    access,
  );
  await auth.registerWorkshop({ displayName: 'Anh Thợ', organizationName: 'Xưởng An', password: 'secret123', email: 'tho.an@example.test', phone: '0912345678' });
  db.users[0].verifiedAt = now;
  const me = await auth.me('factory-user');
  assert.equal(me.capabilities.eurohouse.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(me.capabilities.eurohouse.features.EUROHOUSE_ORDERING.status, 'LOCKED');
});

test('formula-only invite, independent ordering activation, live revoke and old-order mutation denial form one release journey', async () => {
  const { db, prisma, now } = releaseDatabase();
  db.organizations.push({ id: 'factory-a', code: 'CSSX-A', name: 'Xưởng A', type: 'FACTORY', managedByNppId: null, province: 'Hà Nội' });
  db.users.push({ id: 'factory-user', role: 'FACTORY', organizationId: 'factory-a', verifiedAt: now });
  const access = new EurohouseAccessService(prisma, { now: () => now, randomCode: () => 'EH-RELEASE-CODE' });
  const npp = { userId: 'npp-user', role: 'NPP', organizationId: 'npp-a' };
  const factory = { userId: 'factory-user', role: 'FACTORY', organizationId: 'factory-a' };

  const invite = await access.createInvite(npp, 'factory-a', ['FORMULA_CUTTING']);
  await access.redeemInvite(factory, invite.plainCode);
  let view = await access.getAccessView('factory-a');
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'LOCKED');

  await access.activateFeature(npp, 'factory-a', 'EUROHOUSE_ORDERING');
  assert.equal((await access.getCapability('factory-a', 'EUROHOUSE_ORDERING')).status, 'ACTIVE');
  await access.revokeFeature(npp, 'factory-a', 'EUROHOUSE_ORDERING', 'Tạm dừng đặt hàng');
  view = await access.getAccessView('factory-a');
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'REVOKED');

  const orders = new OrdersService(prisma, {} as never, {} as never, access);
  const actor = { sub: 'factory-user', email: 'factory@example.test', displayName: 'Xưởng A', role: 'FACTORY', organizationId: 'factory-a' } as const;
  assert.equal((await orders.getOrder('old-order', actor)).id, 'old-order');
  await assert.rejects(() => orders.deleteOrder('old-order', actor), (error: any) => {
    assert.equal(error.getResponse().code, 'EUROHOUSE_ORDERING_REQUIRED');
    return true;
  });
});
