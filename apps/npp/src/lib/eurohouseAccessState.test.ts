import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearOneTimeCode,
  createEurohouseAccessState,
  eurohouseAccessErrorMessage,
  patchFeatureStatus,
  selectedFeatureKeys,
  selectWorkshop,
  setCreatedInvite,
  setSearchResults,
  toggleInviteFeature,
  workspaceLayout,
} from './eurohouseAccessState.ts';

const row = {
  organizationId: 'factory-1',
  organizationName: 'Xưởng Việt Anh',
  province: 'Hà Nội',
  maskedEmail: 'vi***@example.com',
  maskedPhone: '0912***678',
  relationship: 'MANAGED' as const,
  features: {
    FORMULA_CUTTING: { featureKey: 'FORMULA_CUTTING' as const, status: 'LOCKED' as const, enabled: false, message: 'Module đang xây dựng' },
    EUROHOUSE_ORDERING: { featureKey: 'EUROHOUSE_ORDERING' as const, status: 'ACTIVE' as const, enabled: true, message: 'Đã kích hoạt' },
  },
};

test('invite defaults to formula only and always requires at least one feature', () => {
  let state = createEurohouseAccessState();
  assert.deepEqual(selectedFeatureKeys(state), ['FORMULA_CUTTING']);
  state = toggleInviteFeature(state, 'FORMULA_CUTTING', false);
  assert.deepEqual(selectedFeatureKeys(state), ['FORMULA_CUTTING']);
  state = toggleInviteFeature(state, 'EUROHOUSE_ORDERING', true);
  state = toggleInviteFeature(state, 'FORMULA_CUTTING', false);
  assert.deepEqual(selectedFeatureKeys(state), ['EUROHOUSE_ORDERING']);
});

test('search state retains masked contacts only and updates feature statuses independently', () => {
  let state = setSearchResults(createEurohouseAccessState(), [{ ...row, email: 'vietanh@example.com', phone: '0912345678' }]);
  assert.equal('email' in state.results[0], false);
  assert.equal('phone' in state.results[0], false);
  state = selectWorkshop(state, 'factory-1');
  state = patchFeatureStatus(state, 'factory-1', 'FORMULA_CUTTING', 'ACTIVE', 'MANAGED');
  assert.equal(state.selected?.features.FORMULA_CUTTING.status, 'ACTIVE');
  assert.equal(state.selected?.features.EUROHOUSE_ORDERING.status, 'ACTIVE');
});

test('one-time invite code is cleared explicitly and whenever workshop selection changes', () => {
  let state = setSearchResults(createEurohouseAccessState(), [row]);
  state = selectWorkshop(state, 'factory-1');
  state = setCreatedInvite(state, { plainCode: 'EH-ONCE-1234', expiresAt: '2026-12-01T00:00:00.000Z' });
  assert.equal(state.oneTimeCode, 'EH-ONCE-1234');
  assert.equal(clearOneTimeCode(state).oneTimeCode, undefined);
  assert.equal(selectWorkshop(state, 'factory-1').oneTimeCode, undefined);
});

test('other-NPP conflicts have stable copy and workspace stacks through tablet widths', () => {
  assert.match(eurohouseAccessErrorMessage(new Error('TRANSFER_REQUIRES_ADMIN')), /NPP khác/);
  assert.equal(workspaceLayout(375), 'STACKED');
  assert.equal(workspaceLayout(768), 'STACKED');
  assert.equal(workspaceLayout(1024), 'STACKED');
  assert.equal(workspaceLayout(1280), 'SPLIT');
  assert.equal(workspaceLayout(1440), 'SPLIT');
});
