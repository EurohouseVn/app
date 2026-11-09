import test from 'node:test';
import assert from 'node:assert/strict';

const access = await import('./index.ts');

test('keeps formula cutting and Eurohouse ordering as independent feature capabilities', () => {
  assert.deepEqual(access.EUROHOUSE_FEATURE_KEYS, ['FORMULA_CUTTING', 'EUROHOUSE_ORDERING']);

  assert.deepEqual(access.featureCapability('LOCKED', 'FORMULA_CUTTING'), {
    featureKey: 'FORMULA_CUTTING',
    status: 'LOCKED',
    enabled: false,
    message: 'Module đang xây dựng',
  });
  assert.deepEqual(access.featureCapability('ACTIVE', 'EUROHOUSE_ORDERING'), {
    featureKey: 'EUROHOUSE_ORDERING',
    status: 'ACTIVE',
    enabled: true,
    message: 'Đặt hàng Nhôm Eurohouse đã được kích hoạt',
  });
  assert.deepEqual(access.featureCapability('LOCKED', 'EUROHOUSE_ORDERING'), {
    featureKey: 'EUROHOUSE_ORDERING',
    status: 'LOCKED',
    enabled: false,
    message: 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.',
  });
});

test('allows guest discovery and local utilities without exposing account-only operations', () => {
  assert.deepEqual(access.PUBLIC_GUEST_FEATURE_KEYS, [
    'weather',
    'attendance:basic',
    'quotation:manual',
    'eurohouse:catalog',
    'eurohouse:library',
    'eurohouse:knowledge',
    'eurohouse:promotions',
  ]);
  assert.equal(access.PUBLIC_GUEST_FEATURE_KEYS.includes('factory:projects'), false);
  assert.equal(access.PUBLIC_GUEST_FEATURE_KEYS.includes('factory:orders'), false);
});

test('registered free modules include workshop management but exclude Eurohouse mutations', () => {
  assert.ok(Array.isArray(access.REGISTERED_FREE_MODULE_KEYS));
  assert.equal(access.REGISTERED_FREE_MODULE_KEYS.includes('factory:projects'), true);
  assert.equal(access.REGISTERED_FREE_MODULE_KEYS.includes('factory:debts'), true);
  assert.equal(access.REGISTERED_FREE_MODULE_KEYS.includes('factory:payroll'), true);
  assert.equal(access.REGISTERED_FREE_MODULE_KEYS.includes('factory:orders'), false);
  assert.equal(access.REGISTERED_FREE_MODULE_KEYS.includes('factory:formulas'), false);
});

test('derives guest, registered and Eurohouse-linked tiers from identity and relationship', () => {
  assert.equal(typeof access.accessTierFor, 'function');
  assert.equal(access.accessTierFor(undefined, undefined), 'GUEST');
  assert.equal(access.accessTierFor({ id: 'user-1' }, undefined), 'REGISTERED');
  assert.equal(
    access.accessTierFor(
      { id: 'user-1' },
      {
        organizationId: 'factory-1',
        nppOrganizationId: 'npp-1',
        features: {
          FORMULA_CUTTING: access.featureCapability('LOCKED', 'FORMULA_CUTTING'),
          EUROHOUSE_ORDERING: access.featureCapability('LOCKED', 'EUROHOUSE_ORDERING'),
        },
      },
    ),
    'EUROHOUSE_LINKED',
  );
});

test('legacy formula capability remains an adapter over formula cutting', () => {
  assert.deepEqual(access.formulaCapabilityFromStatus('REVOKED'), {
    status: 'REVOKED',
    enabled: false,
    message: 'Quyền sử dụng Công thức Eurohouse đã được thu hồi',
  });
  assert.deepEqual(access.formulaCapabilityFromStatus('ACTIVE'), {
    status: 'ACTIVE',
    enabled: true,
    message: 'Công thức Eurohouse đã được kích hoạt',
  });
});
