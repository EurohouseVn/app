import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amountDue,
  compactVnd,
  contractValue,
  filterProjects,
  hasDebt,
  isStale,
  needsAttention,
  projectSummary,
  sortForList,
  type ProjectListItem,
} from './projectListState.ts';

const NOW = new Date('2026-11-18T09:00:00+07:00').getTime();
const DAY = 86_400_000;

function project(overrides: Partial<ProjectListItem>): ProjectListItem {
  return {
    id: 'p', code: 'CT-1', name: 'Công trình', customerName: '', status: 'IN_PROGRESS',
    estimatedAmount: 0, finalAmount: 0, createdAt: NOW - 30 * DAY, updatedAt: NOW - DAY,
    ...overrides,
  };
}

test('contract value prefers the settled amount over the estimate', () => {
  assert.equal(contractValue(project({ estimatedAmount: 400, finalAmount: 455 })), 455);
  assert.equal(contractValue(project({ estimatedAmount: 400, finalAmount: 0 })), 400);
});

test('amount due is unknown until the server reports receipts, never negative', () => {
  assert.equal(amountDue(project({ finalAmount: 455 })), undefined);
  assert.equal(amountDue(project({ finalAmount: 455, receivedAmount: 300 })), 155);
  assert.equal(amountDue(project({ finalAmount: 455, receivedAmount: 500 })), 0);
  assert.equal(amountDue(project({ status: 'CANCELLED', finalAmount: 455, receivedAmount: 0 })), 0);
  // A quotation is not a debt yet.
  assert.equal(amountDue(project({ status: 'OPEN', finalAmount: 38, receivedAmount: 0 })), 0);
});

test('money still owed counts as debt while running and after completion', () => {
  assert.equal(hasDebt(project({ status: 'IN_PROGRESS', finalAmount: 100, receivedAmount: 40 })), true);
  assert.equal(hasDebt(project({ status: 'DONE', finalAmount: 455, receivedAmount: 450 })), true);
  assert.equal(hasDebt(project({ status: 'DONE', finalAmount: 455, receivedAmount: 455 })), false);
  assert.equal(hasDebt(project({ status: 'OPEN', finalAmount: 38, receivedAmount: 0 })), false);
  assert.equal(hasDebt(project({ status: 'IN_PROGRESS', finalAmount: 100 })), false);
});

test('only open or running projects go stale, after more than 14 days', () => {
  assert.equal(isStale(project({ updatedAt: NOW - 15 * DAY }), NOW), true);
  assert.equal(isStale(project({ updatedAt: NOW - 14 * DAY }), NOW), false);
  assert.equal(isStale(project({ status: 'OPEN', updatedAt: NOW - 40 * DAY }), NOW), true);
  assert.equal(isStale(project({ status: 'DONE', updatedAt: NOW - 90 * DAY }), NOW), false);
});

test('needs attention = running with money still due, or stale', () => {
  assert.equal(needsAttention(project({ finalAmount: 100, receivedAmount: 40 }), NOW), true);
  assert.equal(needsAttention(project({ finalAmount: 100, receivedAmount: 100 }), NOW), false);
  assert.equal(needsAttention(project({ status: 'OPEN', finalAmount: 100, receivedAmount: 0 }), NOW), false);
  assert.equal(needsAttention(project({ updatedAt: NOW - 20 * DAY }), NOW), true);
});

test('search ignores Vietnamese accents and matches name, customer or code', () => {
  const list = [
    project({ id: 'a', name: 'Nhà Chú Tiểu Cường', customerName: 'Mr Tiểu Cường', code: 'CT-261020-8F12B1' }),
    project({ id: 'b', name: 'Showroom Hoàng Gia', customerName: 'Công ty Hoàng Gia', code: 'CT-260915-77B310' }),
  ];
  assert.deepEqual(filterProjects(list, { query: 'tieu cuong', filter: 'ALL' }, NOW).map((p) => p.id), ['a']);
  assert.deepEqual(filterProjects(list, { query: 'HOANG gia', filter: 'ALL' }, NOW).map((p) => p.id), ['b']);
  assert.deepEqual(filterProjects(list, { query: '77b3', filter: 'ALL' }, NOW).map((p) => p.id), ['b']);
  assert.deepEqual(filterProjects(list, { query: '  ', filter: 'ALL' }, NOW).map((p) => p.id), ['a', 'b']);
});

test('filters by status, by money due and by attention', () => {
  const list = [
    project({ id: 'run-debt', finalAmount: 100, receivedAmount: 10 }),
    project({ id: 'run-paid', finalAmount: 100, receivedAmount: 100 }),
    project({ id: 'quote', status: 'OPEN' }),
    project({ id: 'done', status: 'DONE' }),
    project({ id: 'stale', status: 'OPEN', updatedAt: NOW - 30 * DAY }),
  ];
  const ids = (filter: Parameters<typeof filterProjects>[1]['filter']) => filterProjects(list, { query: '', filter }, NOW).map((p) => p.id);
  assert.deepEqual(ids('IN_PROGRESS'), ['run-debt', 'run-paid']);
  assert.deepEqual(ids('DEBT'), ['run-debt']);
  assert.deepEqual(ids('OPEN'), ['quote', 'stale']);
  assert.deepEqual(ids('ATTENTION'), ['run-debt', 'stale']);
});

test('summary counts running work, money due and this year completed revenue', () => {
  const list = [
    project({ finalAmount: 455, receivedAmount: 300 }),
    project({ finalAmount: 284, receivedAmount: 245 }),
    project({ finalAmount: 50 }), // receipts unknown: not counted as due
    project({ status: 'DONE', finalAmount: 612, receivedAmount: 612, updatedAt: NOW - 40 * DAY }),
    project({ status: 'DONE', finalAmount: 455, receivedAmount: 450, updatedAt: NOW - 3 * DAY }),
    project({ status: 'OPEN', finalAmount: 38, receivedAmount: 0 }), // báo giá: không tính nợ
    project({ status: 'DONE', finalAmount: 999, updatedAt: new Date('2025-12-20').getTime() }),
    project({ status: 'CANCELLED', finalAmount: 70, receivedAmount: 0 }),
  ];
  assert.deepEqual(projectSummary(list, NOW), {
    running: 3,
    totalDue: 199,
    dueKnown: true,
    revenueThisYear: 1067,
    attention: 3,
  });
  assert.equal(projectSummary([project({ finalAmount: 10 })], NOW).dueKnown, false);
});

test('compact money reads like Vietnamese shop talk', () => {
  assert.equal(compactVnd(232_800_000), '232,8 tr');
  assert.equal(compactVnd(155_000_000), '155 tr');
  assert.equal(compactVnd(1_250_000_000), '1,25 tỷ');
  assert.equal(compactVnd(950_000), '950.000 đ');
  assert.equal(compactVnd(0), '0 đ');
});

test('active work comes first, then completed, cancelled last; newest update first in each group', () => {
  const list = [
    project({ id: 'cancelled', status: 'CANCELLED', updatedAt: NOW }),
    project({ id: 'done-new', status: 'DONE', updatedAt: NOW - DAY }),
    project({ id: 'run-old', status: 'IN_PROGRESS', updatedAt: NOW - 9 * DAY }),
    project({ id: 'quote-new', status: 'OPEN', updatedAt: NOW - 2 * DAY }),
    project({ id: 'done-old', status: 'DONE', updatedAt: NOW - 30 * DAY }),
  ];
  assert.deepEqual(sortForList(list).map((p) => p.id), ['quote-new', 'run-old', 'done-new', 'done-old', 'cancelled']);
  assert.equal(list[0].id, 'cancelled', 'input order is not mutated');
});

test('trang chủ: tối đa 3 công trình cần chú ý, còn nợ nhiều lên trước, rồi tới lâu chưa cập nhật', async () => {
  const { homeProjects } = await import('./projectListState.ts');
  const now = Date.parse('2026-11-18T03:00:00Z');
  const day = 86_400_000;
  const p = (id: string, status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED', value: number, received: number | undefined, updatedDaysAgo: number) => ({
    id, code: id, name: `CT ${id}`, customerName: '', status, estimatedAmount: value, finalAmount: 0, receivedAmount: received, createdAt: now - 60 * day, updatedAt: now - updatedDaysAgo * day,
  });
  const list = [
    p('a', 'IN_PROGRESS', 100_000_000, 80_000_000, 1),
    p('b', 'DONE', 300_000_000, 100_000_000, 3),
    p('c', 'IN_PROGRESS', 50_000_000, 50_000_000, 20),
    p('d', 'IN_PROGRESS', 70_000_000, 70_000_000, 2),
    p('e', 'CANCELLED', 90_000_000, 0, 1),
    p('f', 'DONE', 40_000_000, 40_000_000, 1),
  ];
  const home = homeProjects(list, now);
  assert.deepEqual(home.items.map((x) => [x.project.id, x.reason]), [
    ['b', 'Còn phải thu 200 tr'],
    ['a', 'Còn phải thu 20 tr'],
    ['c', '20 ngày chưa cập nhật'],
  ]);
  assert.equal(home.totalDue, 220_000_000);
  assert.equal(home.running, 3);
  // Không có gì cần chú ý thì lấy công trình đang thi công mới cập nhật nhất.
  const calm = homeProjects([p('d', 'IN_PROGRESS', 70_000_000, 70_000_000, 2), p('f', 'DONE', 1, 1, 1)], now);
  assert.deepEqual(calm.items.map((x) => [x.project.id, x.reason]), [['d', 'Đang thi công']]);
  assert.deepEqual(homeProjects([], now), { items: [], totalDue: 0, running: 0 });
});
