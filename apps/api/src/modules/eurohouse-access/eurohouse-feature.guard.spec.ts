import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { Reflector } from '@nestjs/core';
import { EurohouseFeatureGuard } from './eurohouse-feature.guard';
import {
  EUROHOUSE_FEATURE_REQUIRED_KEY,
  RequiresEurohouseFeature,
} from './eurohouse-feature.decorator';
import { OrdersController } from '../orders/orders.controller';
import { QuotationsController } from '../quotations/quotations.controller';

function context(user: any, featureKey: 'FORMULA_CUTTING' | 'EUROHOUSE_ORDERING') {
  class TestController {}
  const handler = () => undefined;
  Reflect.defineMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, featureKey, handler);
  return {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

test('active factory passes while locked and revoked factory receive a stable ordering denial', async () => {
  let status: 'LOCKED' | 'ACTIVE' | 'REVOKED' = 'LOCKED';
  const guard = new EurohouseFeatureGuard(
    new Reflector(),
    { getCapability: async () => ({ status, enabled: status === 'ACTIVE' }) } as any,
  );
  const actor = { sub: 'factory-user', role: 'FACTORY', organizationId: 'factory-org' };

  await assert.rejects(() => guard.canActivate(context(actor, 'EUROHOUSE_ORDERING')), (error: any) => {
    assert.equal(error.getResponse().code, 'EUROHOUSE_ORDERING_REQUIRED');
    return true;
  });
  status = 'ACTIVE';
  assert.equal(await guard.canActivate(context(actor, 'EUROHOUSE_ORDERING')), true);
  status = 'REVOKED';
  await assert.rejects(() => guard.canActivate(context(actor, 'EUROHOUSE_ORDERING')), (error: any) => {
    assert.equal(error.getResponse().code, 'EUROHOUSE_ORDERING_REQUIRED');
    return true;
  });
});

test('revocation is evaluated live on the next request', async () => {
  let active = true;
  const guard = new EurohouseFeatureGuard(
    new Reflector(),
    { getCapability: async () => ({ status: active ? 'ACTIVE' : 'REVOKED' }) } as any,
  );
  const actor = { sub: 'factory-user', role: 'DAILY', organizationId: 'factory-org' };
  assert.equal(await guard.canActivate(context(actor, 'EUROHOUSE_ORDERING')), true);
  active = false;
  await assert.rejects(() => guard.canActivate(context(actor, 'EUROHOUSE_ORDERING')));
});

test('NPP and internal actors retain their existing role-authorized workflows', async () => {
  const guard = new EurohouseFeatureGuard(
    new Reflector(),
    { getCapability: async () => ({ status: 'LOCKED' }) } as any,
  );
  for (const role of ['NPP', 'ADMIN', 'STAFF']) {
    assert.equal(
      await guard.canActivate(context({ sub: `${role}-user`, role }, 'EUROHOUSE_ORDERING')),
      true,
    );
  }
});

test('feature decorator records the exact requested feature', () => {
  class ExampleController {
    @RequiresEurohouseFeature('FORMULA_CUTTING')
    formula() {}
  }
  assert.equal(
    Reflect.getMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, ExampleController.prototype.formula),
    'FORMULA_CUTTING',
  );
});

test('ordering policy guards mutations but leaves owned order reads and PDFs available', () => {
  const guarded = [
    OrdersController.prototype.createOrder,
    OrdersController.prototype.convertFromQuotation,
    OrdersController.prototype.deleteOrder,
    OrdersController.prototype.updateOrder,
    OrdersController.prototype.submitOrderToNpp,
    QuotationsController.prototype.createOrderDraftFromProject,
  ];
  for (const handler of guarded) {
    assert.equal(
      Reflect.getMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, handler),
      'EUROHOUSE_ORDERING',
    );
  }
  assert.equal(Reflect.getMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, OrdersController.prototype.getOrder), undefined);
  assert.equal(Reflect.getMetadata(EUROHOUSE_FEATURE_REQUIRED_KEY, OrdersController.prototype.orderPdf), undefined);
});
