import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createFormulaAccessState,
  formulaAccessErrorMessage,
  inviteStatusLabel,
  selectWorkshop,
  setCreatedInvite,
  setSearchResults,
  statusLabel,
} from './formulaAccessState.ts';

const rows = [
  { organizationId: 'factory-1', organizationName: 'Xưởng Nhôm Kính Tên Rất Dài Minh Phát', maskedEmail: 'mi***@example.com', maskedPhone: '+849***678', relationship: 'UNASSIGNED' as const, status: 'LOCKED' as const },
  { organizationId: 'factory-2', organizationName: 'Xưởng An', maskedPhone: '+848***999', relationship: 'MANAGED' as const, status: 'ACTIVE' as const },
];

test('keeps search results masked and selected panel status consistent with its row', () => {
  let state = setSearchResults(createFormulaAccessState(), rows);
  assert.equal(JSON.stringify(state.results).includes('minh@example.com'), false);
  state = selectWorkshop(state, 'factory-2');
  assert.equal(state.selected?.organizationId, 'factory-2');
  assert.equal(statusLabel(state.selected!.status), 'Đã kích hoạt');
  state = setSearchResults(state, [{ ...rows[1], status: 'REVOKED' }]);
  assert.equal(state.selected?.status, 'REVOKED');
  assert.equal(statusLabel(state.selected!.status), 'Đã thu hồi');
});

test('shows a newly created invite code once and clears it when another workshop is selected', () => {
  let state = setSearchResults(createFormulaAccessState(), rows);
  state = selectWorkshop(state, 'factory-1');
  state = setCreatedInvite(state, { plainCode: 'EUROH-SECRET-1234', expiresAt: '2026-12-08T00:00:00.000Z' });
  assert.equal(state.oneTimeCode, 'EUROH-SECRET-1234');
  state = selectWorkshop(state, 'factory-2');
  assert.equal(state.oneTimeCode, undefined);
});

test('normalizes invite and access statuses for NPP operators', () => {
  assert.equal(inviteStatusLabel('ACTIVE'), 'Còn hiệu lực');
  assert.equal(inviteStatusLabel('EXPIRED'), 'Đã hết hạn');
  assert.equal(inviteStatusLabel('REVOKED'), 'Đã thu hồi');
  assert.equal(statusLabel('LOCKED'), 'Chưa kích hoạt');
});

test('explains that cross-NPP ownership requires Admin transfer', () => {
  assert.equal(formulaAccessErrorMessage('TRANSFER_REQUIRES_ADMIN'), 'Cơ sở đang thuộc NPP khác. Chỉ Admin Eurohouse có thể chuyển NPP quản lý.');
});

test('NPP shell collapses the fixed sidebar before phone width', () => {
  const shell = readFileSync(resolve(process.cwd(), 'src', 'NppShell.tsx'), 'utf8');
  const globalCss = readFileSync(resolve(process.cwd(), 'app', 'globals.css'), 'utf8');
  assert.match(shell, /className="npp-shell"/);
  assert.match(globalCss, /@media \(max-width: 760px\)/);
  assert.match(globalCss, /\.npp-shell[\s\S]*grid-template-columns: 1fr/);
});
