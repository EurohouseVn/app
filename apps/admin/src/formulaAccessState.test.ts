import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildRevokePayload,
  buildTransferPayload,
  filterFormulaAccessRows,
  toFormulaAccessCards,
  type AdminFormulaAccessRow,
} from './formulaAccessState.ts';

const rows: AdminFormulaAccessRow[] = [
  {
    organizationId: 'factory-1',
    organizationName: 'Xưởng Nhôm Kính Minh Phát',
    province: 'Hà Nội',
    status: 'ACTIVE',
    nppOrganizationId: 'npp-1',
    nppOrganizationName: 'NPP Miền Bắc',
    updatedAt: '2026-11-08T10:00:00.000Z',
  },
  {
    organizationId: 'factory-2',
    organizationName: 'Cơ khí An Gia',
    province: 'Đà Nẵng',
    status: 'REVOKED',
    nppOrganizationId: 'npp-2',
    nppOrganizationName: 'NPP Miền Trung',
    updatedAt: '2026-11-07T10:00:00.000Z',
  },
];

test('filters formula grants by status, NPP and workshop text', () => {
  assert.deepEqual(filterFormulaAccessRows(rows, { status: 'ACTIVE', nppOrganizationId: 'npp-1', query: 'minh phát' }).map((row) => row.organizationId), ['factory-1']);
  assert.deepEqual(filterFormulaAccessRows(rows, { status: 'REVOKED', nppOrganizationId: '', query: 'đà nẵng' }).map((row) => row.organizationId), ['factory-2']);
});

test('transforms desktop rows into complete mobile cards', () => {
  const cards = toFormulaAccessCards(rows);
  assert.deepEqual(cards[0], {
    id: 'factory-1',
    title: 'Xưởng Nhôm Kính Minh Phát',
    location: 'Hà Nội',
    status: 'Đã kích hoạt',
    npp: 'NPP Miền Bắc',
    updatedAt: '08/11/2026',
  });
});

test('requires explicit reasons for transfers and revocations', () => {
  assert.throws(() => buildTransferPayload('npp-2', '  '), /TRANSFER_REASON_REQUIRED/);
  assert.throws(() => buildTransferPayload('', 'Chuyển vùng phụ trách'), /NPP_REQUIRED/);
  assert.deepEqual(buildTransferPayload('npp-2', ' Chuyển vùng phụ trách '), { nextNppOrganizationId: 'npp-2', reason: 'Chuyển vùng phụ trách' });
  assert.throws(() => buildRevokePayload('x'), /REVOKE_REASON_REQUIRED/);
  assert.deepEqual(buildRevokePayload(' Tạm dừng theo yêu cầu '), { reason: 'Tạm dừng theo yêu cầu' });
});

test('admin shell exposes formula access under the users permission and responsive cards', () => {
  const shell = readFileSync(resolve(process.cwd(), 'src', 'AdminShell.tsx'), 'utf8');
  const css = readFileSync(resolve(process.cwd(), 'app', 'globals.css'), 'utf8');
  assert.match(shell, /href: '\/formula-access'[\s\S]*moduleKey: 'users'/);
  assert.match(css, /@media \(max-width: 800px\)[\s\S]*\.formula-access-table[\s\S]*display: none/);
  assert.match(css, /\.formula-access-cards[\s\S]*display: grid/);
});
