import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { JwtUser } from '../../auth/current-user.decorator';
import { OrdersService, calculateNppDeliveryPricing } from './orders.service';

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
  return { service: new OrdersService(prisma as never, {} as never, {} as never), calls };
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
  const service = new OrdersService(prisma as never, {} as never, {} as never);
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
  const service = new OrdersService(prisma as never, {} as never, {} as never);
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
  const service = new OrdersService(prisma as never, {} as never, {} as never);
  await assert.rejects(
    service.deleteOrder('order-1', user({ role: 'FACTORY' })),
    BadRequestException,
  );
});

test('revoked CSSX can still read its old order but cannot mutate or submit it', async () => {
  const oldOrder = {
    id: 'order-old',
    code: 'CSSX-OLD-01',
    status: 'DRAFT',
    createdById: 'user-own',
    nppOrgId: 'npp-1',
    items: [],
    histories: [],
  };
  const prisma = {
    order: { findFirst: async () => oldOrder },
  };
  const access = {
    getCapability: async () => ({ status: 'REVOKED', enabled: false }),
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never, access as never);
  const actor = user({ role: 'FACTORY' });

  assert.equal((await service.getOrder('order-old', actor)).id, 'order-old');
  await assert.rejects(() => service.deleteOrder('order-old', actor), (error: any) => {
    assert.equal(error.getResponse().code, 'EUROHOUSE_ORDERING_REQUIRED');
    return true;
  });
  await assert.rejects(() => service.submitOrderToNpp('order-old', actor), (error: any) => {
    assert.equal(error.getResponse().code, 'EUROHOUSE_ORDERING_REQUIRED');
    return true;
  });
});

test('factory order never inherits the company catalog price', async () => {
  type CapturedOrderData = {
    totalAmount: number;
    theoreticalTotalKg: number;
    pricingStatus: string;
    items: { create: Array<{ unitPrice: number; totalPrice: number }> };
    histories: { create: unknown[] };
    [key: string]: unknown;
  };
  let createdData: CapturedOrderData | undefined;
  const prisma = {
    profile: {
      findMany: async () => [{
        id: 'profile-1', code: 'C3300', name: 'Xập ghép khung', kgPerMeter: 0.35,
        barLengthMm: 6000, pricePerKg: 92000,
      }],
    },
    user: {
      findUnique: async () => ({
        id: 'user-own', role: 'FACTORY', displayName: 'Xưởng thử nghiệm', phone: '0901',
        organization: {
          id: 'org-own', code: 'XUONG-01', shortLabel: 'X01', name: 'Xưởng thử nghiệm',
          productionName: 'Xưởng thử nghiệm', type: 'FACTORY', managedByNppId: 'npp-1', address: 'Thanh Hóa',
        },
      }),
    },
    organization: {
      findUnique: async () => ({ id: 'npp-1', name: 'NPP Thanh Hóa' }),
    },
    order: {
      count: async () => 0,
      create: async ({ data }: { data: CapturedOrderData }) => {
        createdData = data;
        return { id: 'order-1', ...data, items: data.items.create, histories: data.histories.create };
      },
    },
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never);

  const result = await service.createOrder({
    sourceType: 'FACTORY', submitToNpp: true,
    items: [{ profileId: 'profile-1', productCode: 'IGNORED', productName: 'IGNORED', colorCode: 'CAFE_METALIC', quantity: 2 }],
  }, 'user-own');

  assert.ok(createdData);
  assert.equal(createdData.totalAmount, 0);
  assert.equal(createdData.pricingStatus, 'PENDING_NPP');
  assert.equal(createdData.theoreticalTotalKg, 4.2);
  assert.equal(createdData.items.create[0].unitPrice, 0);
  assert.equal(createdData.items.create[0].totalPrice, 0);
  assert.equal(result.totalAmount, 0);
});

test('NPP company order receives the same automatic PO and order code', async () => {
  let createdData: any;
  const prisma = {
    profile: { findMany: async () => [{ id: 'profile-1', code: 'TQ01', name: 'Ray khung', kgPerMeter: 1, barLengthMm: 6000, pricePerKg: 90000 }] },
    user: { findUnique: async () => ({
      id: 'npp-user', role: 'NPP', displayName: 'NPP Việt Anh', phone: '0901',
      organization: { id: 'npp-org', code: 'NPP-THVA02', shortLabel: 'THVA02', name: 'NPP Việt Anh', type: 'NPP', phone: '0901', address: 'Thanh Hóa' },
    }) },
    order: {
      count: async () => 0,
      create: async ({ data }: { data: any }) => {
        createdData = data;
        return { id: 'order-npp', ...data, items: data.items.create, histories: data.histories.create };
      },
    },
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never);
  const created = await service.createOrder({
    sourceType: 'NPP_TO_ADMIN',
    items: [{ profileId: 'profile-1', productCode: 'TQ01', productName: 'Ray khung', colorCode: 'CAFE_METALIC', quantity: 2 }],
  }, 'npp-user');

  assert.match(created.code, /^NPP-THVA02-\d{8}-01$/);
  assert.equal(created.poNo, created.code);
  assert.equal(createdData.nppOrgId, 'npp-org');
});

test('non-NPP user cannot create an NPP company order', async () => {
  const prisma = {
    profile: { findMany: async () => [{ id: 'profile-1', code: 'TQ01', name: 'Ray khung', kgPerMeter: 1, barLengthMm: 6000, pricePerKg: 90000 }] },
    user: { findUnique: async () => ({ id: 'factory-user', role: 'FACTORY', organization: { id: 'factory-org', code: 'CSSX-01', type: 'FACTORY' } }) },
  };
  const service = new OrdersService(prisma as never, {} as never, {} as never);
  await assert.rejects(service.createOrder({
    sourceType: 'NPP_TO_ADMIN',
    items: [{ profileId: 'profile-1', productCode: 'TQ01', productName: 'Ray khung', colorCode: 'CAFE_METALIC', quantity: 2 }],
  }, 'factory-user'), BadRequestException);
});

test('admin shipment copies NPP, PO and items from the source order', async () => {
  let shipmentData: any;
  let sourceUpdate: any;
  const sourceOrder = {
    id: 'po-1', code: 'NPP-THVA02-20261107-01', poNo: 'NPP-THVA02-20261107-01', sourceType: 'NPP_TO_ADMIN', status: 'NEW',
    nppOrg: { id: 'npp-org', code: 'NPP-THVA02', name: 'NPP Việt Anh', type: 'NPP', phone: '0901', address: 'Thanh Hóa' },
    items: [{ id: 'item-1', productCode: 'TQ01', productName: 'Ray khung', colorCode: 'CAFE_METALIC', quantity: 2,
      profile: { id: 'profile-1', code: 'TQ01', name: 'Ray khung', kgPerMeter: 1, barLengthMm: 6000, pricePerKg: 90000, stockBars: 20 } }],
  };
  const tx = {
    order: {
      findUnique: async () => sourceOrder,
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }: { data: any }) => { shipmentData = data; return { id: 'shipment-1', ...data }; },
      update: async ({ data }: { data: any }) => { sourceUpdate = data; return sourceOrder; },
    },
    profile: { updateMany: async () => ({ count: 1 }) },
    profileStockMovement: { create: async () => ({ id: 'move-1' }) },
  };
  const commands = { execute: async (_command: unknown, _input: unknown, handler: (client: typeof tx) => Promise<unknown>) => handler(tx) };
  const service = new OrdersService({} as never, {} as never, commands as never);
  const result: any = await service.createAdminToNppShipment(
    { sourceOrderId: 'po-1', actualTotalKg: 12, note: 'Giao tại kho NPP' },
    'admin-1',
    { idempotencyKey: 'shipment-test-1', actorId: 'admin-1', ownerType: 'COMPANY_STOCK', ownerId: 'GLOBAL', command: 'CREATE_ADMIN_NPP_SHIPMENT' },
  );
  assert.match(result.invoiceNo, /^HD-NPP-THVA02-\d{8}-01$/);
  assert.equal(shipmentData.poNo, sourceOrder.poNo);
  assert.equal(shipmentData.nppOrgId, sourceOrder.nppOrg.id);
  assert.equal(shipmentData.items.create[0].profileId, 'profile-1');
  assert.equal(sourceUpdate.status, 'SHIPPED');
});

test('admin shipment rejects an order that is not an NPP company PO', async () => {
  const tx = { order: { findUnique: async () => ({ id: 'wrong', sourceType: 'FACTORY', status: 'NEW' }) } };
  const commands = { execute: async (_command: unknown, _input: unknown, handler: (client: typeof tx) => Promise<unknown>) => handler(tx) };
  const service = new OrdersService({} as never, {} as never, commands as never);
  await assert.rejects(service.createAdminToNppShipment(
    { sourceOrderId: 'wrong' }, 'admin-1',
    { idempotencyKey: 'shipment-test-2', actorId: 'admin-1', ownerType: 'COMPANY_STOCK', ownerId: 'GLOBAL', command: 'CREATE_ADMIN_NPP_SHIPMENT' },
  ), BadRequestException);
});

test('NPP delivery pricing uses actual kg and the NPP-confirmed unit price', () => {
  const pricing = calculateNppDeliveryPricing({
    actualTotalKg: 102.345,
    finalUnitPricePerKg: 92500,
    discountAmount: 50000,
    surchargeAmount: 120000,
  });

  assert.deepEqual(pricing, {
    actualTotalKg: 102.34,
    finalUnitPricePerKg: 92500,
    discountAmount: 50000,
    surchargeAmount: 120000,
    subtotalAmount: 9466450,
    finalTotalAmount: 9536450,
  });
});

test('NPP delivery pricing rejects a missing selling price', () => {
  assert.throws(
    () => calculateNppDeliveryPricing({ actualTotalKg: 100, finalUnitPricePerKg: 0 }),
    BadRequestException,
  );
});
