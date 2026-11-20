import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_ACTIONS, actionGroups, isActionLocked, primaryActions, tileTone } from './homeActions.ts';

test('8 ô chính: Báo giá và Đặt nhôm đứng đầu, ô Tất cả ở cuối', () => {
  const tiles = primaryActions();
  assert.equal(tiles.length, 8);
  assert.deepEqual(tiles.map((a) => a.key), ['quote', 'orders', 'projects', 'formulas', 'workforce', 'debts', 'invoices', 'all']);
});

test('icon theo nhận diện: chỉ hai việc chính dùng cam, còn lại một màu trung tính', () => {
  const tones = primaryActions().map((a) => tileTone(a, { ordering: true, formulas: true }));
  assert.deepEqual(tones, ['primary', 'primary', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral']);
  // Việc chính đang bị khoá thì không tô cam.
  const orders = HOME_ACTIONS.find((a) => a.key === 'orders')!;
  assert.equal(tileTone(orders, { ordering: false, formulas: true }), 'locked');
  // Không còn bảng màu riêng cho từng tiện ích.
  assert.ok(HOME_ACTIONS.every((a) => !('color' in a) && !('bg' in a)));
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
