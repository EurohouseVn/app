import assert from 'node:assert/strict';
import test from 'node:test';
import type { JwtUser } from '../../auth/current-user.decorator';
import { QuotationsService } from './quotations.service';

function user(overrides: Partial<JwtUser>): JwtUser {
  return {
    sub: 'user-own',
    email: 'user@example.test',
    displayName: 'Test user',
    role: 'FACTORY',
    organizationId: 'org-own',
    ...overrides,
  };
}

function serviceWithQuotationCapture() {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    quotation: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.push(args.where);
        return [];
      },
    },
  };
  return { service: new QuotationsService(prisma as never, {} as never, {} as never), calls };
}

test('CSSX quotation list ignores a forged creator filter', async () => {
  const { service, calls } = serviceWithQuotationCapture();
  await service.listQuotations({ createdById: 'user-other' }, user({ role: 'FACTORY' }));
  assert.equal(calls[0].createdById, 'user-own');
});

test('NPP quotation list is scoped to its own login', async () => {
  const { service, calls } = serviceWithQuotationCapture();
  await service.listQuotations({}, user({ role: 'NPP' }));
  assert.equal(calls[0].createdById, 'user-own');
});

test('Admin may explicitly filter quotations by creator', async () => {
  const { service, calls } = serviceWithQuotationCapture();
  await service.listQuotations({ createdById: 'user-other' }, user({ role: 'ADMIN' }));
  assert.equal(calls[0].createdById, 'user-other');
});

test('issuer profile is resolved from the organization of the requested login', async () => {
  const prisma = {
    user: {
      findUnique: async (args: { where: { id: string } }) => {
        assert.equal(args.where.id, 'factory-user');
        return {
          id: 'factory-user',
          email: 'xuong-a@example.test',
          displayName: 'Tài khoản xưởng A',
          phone: '0900000000',
          role: 'FACTORY',
          organizationId: 'factory-a',
          organization: {
            id: 'factory-a',
            code: 'CSSX-A',
            type: 'FACTORY',
            name: 'Xưởng A',
            productionName: 'NHÔM KÍNH XƯỞNG A',
            logoUrl: '/static/uploads/factory-a/logo.png',
            address: 'Địa chỉ A',
            phone: '0911111111',
            email: 'contact@xuong-a.test',
            fanpage: 'xuong-a.test',
            mainCategories: 'Nhôm kính dân dụng',
          },
        };
      },
    },
  };
  const service = new QuotationsService(prisma as never, {} as never, {} as never);
  const profile = await service.getNppProfile('factory-user');
  assert.equal(profile?.organizationId, 'factory-a');
  assert.equal(profile?.productionName, 'NHÔM KÍNH XƯỞNG A');
  assert.equal(profile?.logoUrl, '/static/uploads/factory-a/logo.png');
  assert.equal(profile?.phone, '0911111111');
});

test('profile updates are scoped to the current user organization', async () => {
  const updates: Array<Record<string, unknown>> = [];
  let organization = {
    id: 'factory-own',
    code: 'CSSX-OWN',
    type: 'FACTORY',
    name: 'Xưởng cũ',
    productionName: 'Xưởng cũ',
    logoUrl: '',
    address: '',
    phone: '',
    email: '',
    fanpage: '',
    mainCategories: '',
  };
  const prisma = {
    user: {
      findUnique: async () => ({
        id: 'user-own', email: 'own@example.test', displayName: 'Xưởng cũ', phone: '', role: 'FACTORY',
        organizationId: 'factory-own', organization,
      }),
    },
    organization: {
      update: async (args: { where: { id: string }; data: Record<string, string> }) => {
        updates.push(args as unknown as Record<string, unknown>);
        organization = { ...organization, ...args.data };
        return organization;
      },
    },
  };
  const service = new QuotationsService(prisma as never, {} as never, {} as never);
  const profile = await service.updateNppProfile('user-own', {
    productionName: '  NHÔM KÍNH MINH AN  ',
    logoUrl: ' /static/uploads/factory-own/logo.png ',
    organizationId: 'factory-other',
  });
  assert.deepEqual((updates[0].where as Record<string, unknown>), { id: 'factory-own' });
  assert.deepEqual(updates[0].data, {
    productionName: 'NHÔM KÍNH MINH AN',
    logoUrl: '/static/uploads/factory-own/logo.png',
    name: 'NHÔM KÍNH MINH AN',
  });
  assert.equal(profile?.organizationId, 'factory-own');
  assert.equal(profile?.productionName, 'NHÔM KÍNH MINH AN');
});
