import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ACTIONS, actionGroups, isActionLocked, primaryActions } from './homeActions.ts';

test('8 ô chính: 7 tiện ích dùng nhiều và ô Tất cả ở cuối', () => {
  const tiles = primaryActions();
  assert.equal(tiles.length, 8);
  assert.deepEqual(tiles.map((a) => a.key), ['orders', 'quote', 'formulas', 'projects', 'workforce', 'debts', 'invoices', 'all']);
});

test('bảng Tất cả: hai nhóm, đủ mọi tiện ích, không lặp, không có ô Tất cả', () => {
  const groups = actionGroups();
  assert.deepEqual(groups.map((g) => g.title), ['Sản xuất', 'Kinh doanh & quản lý']);
  const keys = groups.flatMap((g) => g.actions.map((a) => a.key));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, HOME_ACTIONS.length);
  assert.ok(!keys.includes('all'));
  for (const route of ['/orders', '/formulas', '/shop-floor', '/qc', '/installations', '/service-warranty', '/media-sync', '/quote', '/projects', '/workforce', '/reminders', '/debts', '/invoices']) {
    assert.ok(HOME_ACTIONS.some((a) => a.href === route), route);
  }
});

test('khoá: Đặt nhôm và Công thức theo quyền Eurohouse, tiện ích khác không khoá', () => {
  const locked = { ordering: false, formulas: false };
  const open = { ordering: true, formulas: true };
  const byKey = (k: string) => HOME_ACTIONS.find((a) => a.key === k)!;
  assert.equal(isActionLocked(byKey('orders'), locked), true);
  assert.equal(isActionLocked(byKey('formulas'), locked), true);
  assert.equal(isActionLocked(byKey('orders'), open), false);
  assert.equal(isActionLocked(byKey('formulas'), { ordering: true, formulas: false }), true);
  assert.equal(isActionLocked(byKey('quote'), locked), false);
});
