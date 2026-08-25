import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { OrdersService } from './orders.service';

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

function serviceWithOrderCapture() {
  const calls: Array<Record<string, unknown>> = [];
  const prisma = {
    order: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        calls.push(args.where);
        return [];
      },
    },
  };
  return { service: new OrdersService(prisma as never, {} as never), calls };
}

test('CSSX list is always scoped to the authenticated user', async () => {
  const { service, calls } = serviceWithOrderCapture();
  await service.listOrders({ createdById: 'user-other' }, user({ role: 'FACTORY' }));
  assert.equal(calls[0].createdById, 'user-own');
  assert.equal(calls[0].nppOrgId, undefined);
});

test('NPP list is always scoped to the authenticated organization', async () => {
  const { service, calls } = serviceWithOrderCapture();
  await service.listOrders({ nppOrgId: 'org-other', createdById: 'user-other' }, user({ role: 'NPP' }));
  assert.equal(calls[0].nppOrgId, 'org-own');
  assert.equal(calls[0].createdById, undefined);
  assert.deepEqual(calls[0].status, { not: 'DRAFT' });
});

test('NPP cannot request draft orders explicitly', async () => {
  const { service, calls } = serviceWithOrderCapture();
  await service.listOrders({ status: 'DRAFT' }, user({ role: 'NPP' }));
  assert.equal(calls[0].status, '__DRAFT_IS_NOT_VISIBLE_TO_NPP__');
});

test('NPP without an organization cannot list orders', async () => {
  const { service } = serviceWithOrderCapture();
  await assert.rejects(
    service.listOrders({}, user({ role: 'NPP', organizationId: undefined })),
    ForbiddenException,
  );
});

test('CSSX cannot convert another user quotation into an order', async () => {
  const prisma = {
    quotation: {
      findUnique: async () => ({ id: 'quote-other', createdById: 'user-other', items: [] }),
    },
  };
  const service = new OrdersService(prisma as never, {} as never);
  await assert.rejects(
    service.convertQuotationToOrder({ quotationId: 'quote-other' }, user({ role: 'FACTORY' })),
    ForbiddenException,
  );
});

test('submitting an already sent order is idempotent', async () => {
  const sentOrder = {
    id: 'order-1',
    code: 'CSSX-260825-01',
    status: 'NEW',
    createdById: 'user-own',
    nppOrgId: 'npp-1',
    nppName: 'NPP Miền Nam',
    items: [],
    histories: [],
  };
  let transactionCalls = 0;
  const prisma = {
    order: { findFirst: async () => sentOrder },
    $transaction: async () => { transactionCalls += 1; },
  };
  const service = new OrdersService(prisma as never, {} as never);
  const result = await service.submitOrderToNpp('order-1', user({ role: 'FACTORY' }));
  assert.equal(result.status, 'NEW');
  assert.equal(transactionCalls, 0);
});

test('sent orders cannot be hard deleted', async () => {
  const prisma = {
    order: {
      findFirst: async () => ({
        id: 'order-1', code: 'CSSX-260825-01', status: 'NEW', createdById: 'user-own', nppOrgId: 'npp-1',
      }),
    },
  };
  const service = new OrdersService(prisma as never, {} as never);
  await assert.rejects(
    service.deleteOrder('order-1', user({ role: 'FACTORY' })),
    BadRequestException,
  );
});
