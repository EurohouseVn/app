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
