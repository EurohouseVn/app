import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AccessTier, EurohouseAccessView, EurohouseFeatureCapability } from '@eurohouse/types';
import {
  canUseEurohouseFeature,
  featureUiState,
  guardEurohouseMutation,
  orderingCta,
  orderingScreenPolicy,
} from './eurohouseFeatureAccess.ts';

function capability(featureKey: EurohouseFeatureCapability['featureKey'], status: EurohouseFeatureCapability['status']): EurohouseFeatureCapability {
  const lockedCopy = featureKey === 'EUROHOUSE_ORDERING'
    ? 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.'
    : 'Module đang xây dựng';
  return {
    featureKey,
    status,
    enabled: status === 'ACTIVE',
    message: status === 'LOCKED' ? lockedCopy : status,
  };
}

function access(formulaStatus: EurohouseFeatureCapability['status'], orderingStatus: EurohouseFeatureCapability['status'], nppOrganizationName?: string): EurohouseAccessView {
  return {
    organizationId: 'factory-1',
    nppOrganizationId: nppOrganizationName ? 'npp-1' : undefined,
    nppOrganizationName,
    features: {
      FORMULA_CUTTING: capability('FORMULA_CUTTING', formulaStatus),
      EUROHOUSE_ORDERING: capability('EUROHOUSE_ORDERING', orderingStatus),
    },
  };
}

test('formula cutting and ordering are authorized independently', () => {
  const formulaOnly = access('ACTIVE', 'LOCKED');
  const orderingOnly = access('LOCKED', 'ACTIVE');

  assert.equal(canUseEurohouseFeature(formulaOnly, 'FORMULA_CUTTING'), true);
  assert.equal(canUseEurohouseFeature(formulaOnly, 'EUROHOUSE_ORDERING'), false);
  assert.equal(canUseEurohouseFeature(orderingOnly, 'FORMULA_CUTTING'), false);
  assert.equal(canUseEurohouseFeature(orderingOnly, 'EUROHOUSE_ORDERING'), true);
});

test('locked ordering uses approved customer copy and never loads or mutates ordering data', async () => {
  const locked = capability('EUROHOUSE_ORDERING', 'LOCKED');
  assert.equal(featureUiState(locked).message, 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.');
  assert.deepEqual(orderingScreenPolicy(locked), {
    canLoadCatalog: false,
    canMutate: false,
    canReadHistory: true,
  });

  let called = false;
  await assert.rejects(
    guardEurohouseMutation(locked, async () => { called = true; }),
    /EUROHOUSE_ORDERING_ACCESS_REQUIRED/,
  );
  assert.equal(called, false);
});

test('ordering CTA matches guest, registered, and NPP-linked states', () => {
  const cases: Array<[AccessTier, EurohouseAccessView | undefined, string]> = [
    ['GUEST', undefined, 'Đăng nhập / Đăng ký'],
    ['REGISTERED', access('LOCKED', 'LOCKED'), 'Nhập mã mời NPP'],
    ['EUROHOUSE_LINKED', access('ACTIVE', 'LOCKED', 'NPP Việt Anh'), 'Liên hệ NPP Việt Anh'],
  ];
  for (const [tier, value, label] of cases) assert.equal(orderingCta(tier, value).label, label);
});

test('revoked access keeps owned order history readable but blocks editing', () => {
  assert.deepEqual(orderingScreenPolicy(capability('EUROHOUSE_ORDERING', 'REVOKED')), {
    canLoadCatalog: false,
    canMutate: false,
    canReadHistory: true,
  });
});

test('mobile call sites do not mount ordering loaders or mutations while locked', () => {
  const orders = readFileSync(resolve(process.cwd(), 'app', 'orders.tsx'), 'utf8');
  const myOrders = readFileSync(resolve(process.cwd(), 'app', 'my-orders.tsx'), 'utf8');
  const detail = readFileSync(resolve(process.cwd(), 'app', 'order', '[id].tsx'), 'utf8');

  assert.match(orders, /function ActiveOrderingScreen/);
  assert.match(orders, /capability\?\.status !== 'ACTIVE'[\s\S]*EurohouseFeatureLocked/);
  assert.match(myOrders, /orderingPolicy\.canMutate/);
  assert.match(detail, /orderingPolicy\.canMutate && order\.status === 'DRAFT'/);
});
