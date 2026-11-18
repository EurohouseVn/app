import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { AdminIamService } from './admin-iam.service';

function storedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    displayName: 'Người dùng',
    email: 'user@example.com',
    phone: null,
    role: 'NPP',
    organizationId: 'org-1',
    organization: { name: 'NPP Việt Anh', type: 'NPP' },
    departmentId: null,
    department: null,
    jobTitle: '',
    isCeo: false,
    moduleAccess: '["npp:orders"]',
    points: 0,
    createdAt: new Date('2026-11-07T00:00:00.000Z'),
    ...overrides,
  };
}

function serviceWithPrisma(user = storedUser()) {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    user: {
      findUnique: async ({ where }: any) => (where.email ? null : user),
      create: async ({ data }: any) => storedUser({ ...data, moduleAccess: data.moduleAccess }),
      update: async ({ data }: any) => {
        calls.push(data);
        return storedUser({ ...user, ...data });
      },
    },
  };
  return { service: new AdminIamService(prisma as any), calls };
}

test('rejects an explicit permission outside the new user role scope', async () => {
  const { service } = serviceWithPrisma();
  await assert.rejects(
    service.createUser({ email: 'npp@example.com', displayName: 'NPP', role: 'NPP', password: '12345678', modules: ['users'] }),
    BadRequestException,
  );
});

test('rejects the full request when valid and cross-scope permissions are mixed', async () => {
  const { service } = serviceWithPrisma();
  await assert.rejects(
    service.createUser({ email: 'npp@example.com', displayName: 'NPP', role: 'NPP', password: '12345678', modules: ['npp:orders', 'users'] }),
    /không thuộc khu vực Nhà phân phối/i,
  );
});

test('rejects CEO status for a portal account', async () => {
  const { service } = serviceWithPrisma();
  await assert.rejects(
    service.createUser({ email: 'factory@example.com', displayName: 'Xưởng', role: 'FACTORY', password: '12345678', isCeo: true, modules: ['factory:orders'] }),
    /CEO.*nội bộ Eurohouse/i,
  );
});

test('changing role without an explicit module list removes stale permissions', async () => {
  const { service, calls } = serviceWithPrisma(storedUser({ role: 'NPP', moduleAccess: '["npp:orders"]' }));
  await service.updateUser('user-1', { role: 'STAFF' });
  assert.equal(calls[0]?.moduleAccess, '[]');
});

test('stores valid permissions belonging to the selected role', async () => {
  const { service, calls } = serviceWithPrisma(storedUser({ role: 'FACTORY', moduleAccess: '[]' }));
  await service.updateUser('user-1', { modules: ['factory:orders', 'factory:inventory'] });
  assert.equal(calls[0]?.moduleAccess, '["factory:orders","factory:inventory"]');
});
