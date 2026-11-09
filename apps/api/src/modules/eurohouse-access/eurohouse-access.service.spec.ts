import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const servicePath = resolve(__dirname, 'eurohouse-access.service.ts');

async function serviceType() {
  assert.equal(existsSync(servicePath), true, 'EurohouseAccessService must exist');
  return import('./eurohouse-access.service');
}

function database() {
  const now = new Date('2026-11-09T03:00:00.000Z');
  const db: any = {
    organizations: [
      { id: 'npp-a', type: 'NPP', name: 'NPP A', managedByNppId: null },
      { id: 'npp-b', type: 'NPP', name: 'NPP B', managedByNppId: null },
      { id: 'factory-a', type: 'FACTORY', name: 'Xưởng A', managedByNppId: null },
      { id: 'factory-b', type: 'FACTORY', name: 'Xưởng B', managedByNppId: null },
    ],
    users: [
      { id: 'factory-user-a', role: 'FACTORY', organizationId: 'factory-a', verifiedAt: now },
      { id: 'factory-user-b', role: 'FACTORY', organizationId: 'factory-b', verifiedAt: null },
    ],
    invites: [] as any[],
    grants: [] as any[],
    audits: [] as any[],
  };

  const prisma: any = {
    organization: {
      findUnique: async ({ where }: any) => {
        const organization = db.organizations.find((row: any) => row.id === where.id) ?? null;
        if (!organization) return null;
        return {
          ...organization,
          managedByNpp: db.organizations.find((row: any) => row.id === organization.managedByNppId) ?? null,
          eurohouseFeatureGrants: db.grants.filter((row: any) => row.organizationId === organization.id),
        };
      },
      update: async ({ where, data }: any) =>
        Object.assign(db.organizations.find((row: any) => row.id === where.id), data),
    },
    user: {
      findFirst: async ({ where }: any) =>
        db.users.find(
          (row: any) =>
            row.organizationId === where.organizationId &&
            row.verifiedAt !== null &&
            (!where.role?.in || where.role.in.includes(row.role)),
        ) ?? null,
    },
    eurohouseFeatureGrant: {
      findUnique: async ({ where }: any) => {
        const key = where.organizationId_featureKey;
        return (
          db.grants.find(
            (row: any) => row.organizationId === key.organizationId && row.featureKey === key.featureKey,
          ) ?? null
        );
      },
      upsert: async ({ where, create, update }: any) => {
        const key = where.organizationId_featureKey;
        let row = db.grants.find(
          (item: any) => item.organizationId === key.organizationId && item.featureKey === key.featureKey,
        );
        if (row) Object.assign(row, update);
        else {
          row = { id: `grant-${db.grants.length + 1}`, createdAt: now, updatedAt: now, ...create };
          db.grants.push(row);
        }
        return row;
      },
      update: async ({ where, data }: any) => {
        const key = where.organizationId_featureKey;
        const row = db.grants.find(
          (item: any) => item.organizationId === key.organizationId && item.featureKey === key.featureKey,
        );
        if (!row) throw new Error('GRANT_NOT_FOUND');
        return Object.assign(row, data);
      },
      updateMany: async ({ where, data }: any) => {
        const rows = db.grants.filter((row: any) => row.organizationId === where.organizationId);
        rows.forEach((row: any) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
    eurohouseInvite: {
      create: async ({ data }: any) => {
        const row = { id: `invite-${db.invites.length + 1}`, createdAt: now, ...data };
        db.invites.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => {
        const row = db.invites.find((item: any) => item.codeHash === where.codeHash) ?? null;
        if (!row) return null;
        return {
          ...row,
          nppOrganization: db.organizations.find((item: any) => item.id === row.nppOrganizationId),
        };
      },
      updateMany: async ({ where, data }: any) => {
        const row = db.invites.find(
          (item: any) => item.id === where.id && item.status === where.status,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    eurohouseAccessAudit: {
      create: async ({ data }: any) => {
        const row = { id: `audit-${db.audits.length + 1}`, createdAt: now, ...data };
        db.audits.push(row);
        return row;
      },
    },
    $transaction: async (work: (tx: any) => unknown) => work(prisma),
  };

  return { db, prisma, now };
}

const nppA = { userId: 'npp-user-a', role: 'NPP', organizationId: 'npp-a' } as const;
const nppB = { userId: 'npp-user-b', role: 'NPP', organizationId: 'npp-b' } as const;
const factoryA = {
  userId: 'factory-user-a',
  role: 'FACTORY',
  organizationId: 'factory-a',
} as const;
const admin = { userId: 'admin-user', role: 'ADMIN' } as const;

test('activates and revokes each Eurohouse feature independently using actor NPP scope', async () => {
  const { EurohouseAccessService } = await serviceType();
  const { db, prisma, now } = database();
  const service = new EurohouseAccessService(prisma, { now: () => now });

  await service.activateFeature(nppA, 'factory-a', 'FORMULA_CUTTING', 'npp-b');
  await service.activateFeature(nppA, 'factory-a', 'EUROHOUSE_ORDERING', 'npp-b');
  await service.revokeFeature(nppA, 'factory-a', 'EUROHOUSE_ORDERING', 'Tạm dừng đặt hàng');

  const view = await service.getAccessView('factory-a');
  assert.equal(view.nppOrganizationId, 'npp-a');
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'REVOKED');
  assert.equal(db.grants.every((grant: any) => grant.nppOrganizationId === 'npp-a'), true);
});

test('creates a target-bound hash-only invite and activates only selected features once', async () => {
  const { EurohouseAccessService } = await serviceType();
  const { db, prisma, now } = database();
  const service = new EurohouseAccessService(prisma, {
    now: () => now,
    randomCode: () => 'EH-ONE-TIME-CODE',
  });

  const created = await service.createInvite(nppA, 'factory-a', [
    'FORMULA_CUTTING',
    'FORMULA_CUTTING',
  ]);
  assert.equal(created.plainCode, 'EH-ONE-TIME-CODE');
  assert.equal(JSON.stringify(db.invites).includes(created.plainCode), false);
  assert.deepEqual(db.invites[0].featureKeys, ['FORMULA_CUTTING']);
  assert.equal(
    db.invites[0].expiresAt.toISOString(),
    new Date(now.getTime() + 30 * 86_400_000).toISOString(),
  );

  const outcomes = await Promise.allSettled([
    service.redeemInvite(factoryA, created.plainCode),
    service.redeemInvite(factoryA, created.plainCode),
  ]);
  assert.equal(outcomes.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    outcomes.filter(
      (result) => result.status === 'rejected' && /INVITE_USED/.test(String(result.reason)),
    ).length,
    1,
  );
  const view = await service.getAccessView('factory-a');
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'LOCKED');
  assert.equal(db.audits.filter((row: any) => row.action === 'INVITE_REDEEMED').length, 1);
});

test('rejects empty feature selection, unverified factories and cross-NPP ownership', async () => {
  const { EurohouseAccessService } = await serviceType();
  const { db, prisma } = database();
  const service = new EurohouseAccessService(prisma);

  await assert.rejects(() => service.createInvite(nppA, 'factory-a', []), /FEATURE_KEYS_REQUIRED/);
  await assert.rejects(
    () => service.createInvite(nppA, 'factory-a', ['UNKNOWN' as never]),
    /FEATURE_KEY_INVALID/,
  );
  await assert.rejects(
    () => service.createInvite(nppA, 'factory-b', ['FORMULA_CUTTING']),
    /FACTORY_NOT_VERIFIED/,
  );

  db.organizations.find((row: any) => row.id === 'factory-a').managedByNppId = 'npp-b';
  await assert.rejects(
    () => service.activateFeature(nppA, 'factory-a', 'FORMULA_CUTTING'),
    /TRANSFER_REQUIRES_ADMIN/,
  );
  assert.equal(db.grants.length, 0);
  assert.equal(db.audits.length, 0);
});

test('Admin transfer changes only the managing NPP and preserves every feature status', async () => {
  const { EurohouseAccessService } = await serviceType();
  const { db, prisma } = database();
  const service = new EurohouseAccessService(prisma);

  await service.activateFeature(admin, 'factory-a', 'FORMULA_CUTTING', 'npp-a');
  await service.activateFeature(admin, 'factory-a', 'EUROHOUSE_ORDERING', 'npp-a');
  await service.revokeFeature(admin, 'factory-a', 'EUROHOUSE_ORDERING', 'Tạm dừng');
  await assert.rejects(
    () => service.transferNpp(nppB, 'factory-a', 'npp-b', 'Sai quyền'),
    /ADMIN_REQUIRED/,
  );

  await service.transferNpp(admin, 'factory-a', 'npp-b', 'Chuyển vùng quản lý');
  const view = await service.getAccessView('factory-a');
  assert.equal(view.nppOrganizationId, 'npp-b');
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'REVOKED');
  assert.deepEqual(db.grants.map((grant: any) => grant.status).sort(), ['ACTIVE', 'REVOKED']);
});
