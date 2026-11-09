import test from 'node:test';
import assert from 'node:assert/strict';
import { INTERNAL_MODULES } from '@eurohouse/types';
import {
  buildActivationPayload,
  buildEurohouseAccessQuery,
  buildFeatureRevokePayload,
  buildTransferPayload,
  rowPresentation,
  workspaceMode,
  type AdminEurohouseAccessRow,
} from './eurohouseAccessState.ts';

const row: AdminEurohouseAccessRow = {
  organizationId: 'factory-1', organizationName: 'Xưởng Việt Anh', province: 'Hà Nội', nppOrganizationId: 'npp-1', nppOrganizationName: 'NPP Việt Anh', updatedAt: '2026-11-09T00:00:00.000Z',
  features: {
    FORMULA_CUTTING: { featureKey: 'FORMULA_CUTTING', status: 'ACTIVE', enabled: true, message: 'Đã kích hoạt' },
    EUROHOUSE_ORDERING: { featureKey: 'EUROHOUSE_ORDERING', status: 'LOCKED', enabled: false, message: 'Chưa kích hoạt' },
  },
};

test('serializes server filters and pagination without empty values', () => {
  assert.deepEqual(buildEurohouseAccessQuery({ featureKey: 'EUROHOUSE_ORDERING', status: 'LOCKED', nppOrganizationId: '', province: 'Hà Nội', page: 2, pageSize: 20 }), {
    featureKey: 'EUROHOUSE_ORDERING', status: 'LOCKED', province: 'Hà Nội', page: '2', pageSize: '20',
  });
});

test('keeps two independent feature cells and complete mobile card data', () => {
  const view = rowPresentation(row);
  assert.equal(view.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(view.features.EUROHOUSE_ORDERING.status, 'LOCKED');
  assert.deepEqual({ title: view.title, province: view.province, npp: view.npp }, { title: 'Xưởng Việt Anh', province: 'Hà Nội', npp: 'NPP Việt Anh' });
});

test('activation, revoke and transfer payloads require explicit selections and reasons', () => {
  assert.throws(() => buildActivationPayload('', 'FORMULA_CUTTING', 'npp-1'), /CSSX_REQUIRED/);
  assert.throws(() => buildActivationPayload('factory-1', 'FORMULA_CUTTING', ''), /NPP_REQUIRED/);
  assert.deepEqual(buildActivationPayload('factory-1', 'EUROHOUSE_ORDERING', 'npp-1'), { organizationId: 'factory-1', featureKey: 'EUROHOUSE_ORDERING', nppOrganizationId: 'npp-1' });
  assert.throws(() => buildFeatureRevokePayload('FORMULA_CUTTING', 'x'), /REVOKE_REASON_REQUIRED/);
  assert.throws(() => buildTransferPayload('', 'Hợp nhất khu vực'), /NPP_REQUIRED/);
});

test('reuses STAFF users permission and switches to complete cards at mobile widths', () => {
  const module = INTERNAL_MODULES.find((item) => item.href === '/eurohouse-access');
  assert.equal(module?.key, 'users');
  assert.equal(workspaceMode(375), 'CARDS');
  assert.equal(workspaceMode(768), 'CARDS');
  assert.equal(workspaceMode(1024), 'TABLE');
});
