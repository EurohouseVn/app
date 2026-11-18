import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canMarkDay,
  daySummary,
  leaveLeft,
  monthLabel,
  moveMonth,
  segmentOf,
  splitEvenly,
} from './workforceState.ts';

test('the day summary counts full, half and off days plus overtime', () => {
  assert.deepEqual(daySummary([
    { status: 'PRESENT', overtimeHours: 2.5 },
    { status: 'PRESENT', overtimeHours: 0 },
    { status: 'HALF', overtimeHours: 0 },
    { status: 'LEAVE', overtimeHours: 0 },
    { status: 'ABSENT', overtimeHours: 0 },
  ]), { full: 2, half: 1, off: 2, overtimeHours: 2.5 });
});

test('each status maps onto one of the three row buttons', () => {
  assert.equal(segmentOf('PRESENT'), 'FULL');
  assert.equal(segmentOf('HALF'), 'HALF');
  assert.equal(segmentOf('LEAVE'), 'OFF');
  assert.equal(segmentOf('UNPAID_LEAVE'), 'OFF');
  assert.equal(segmentOf('ABSENT'), 'OFF');
  assert.equal(segmentOf(undefined), null);
});

test('days can be marked up to today while the month is open', () => {
  assert.deepEqual(canMarkDay('2026-11-18', '2026-11-18', false), { editable: true });
  assert.deepEqual(canMarkDay('2026-11-02', '2026-11-18', false), { editable: true });
  assert.deepEqual(canMarkDay('2026-11-19', '2026-11-18', false), { editable: false, reason: 'Chưa tới ngày này' });
  assert.deepEqual(canMarkDay('2026-10-30', '2026-11-18', true), { editable: false, reason: 'Tháng 10/2026 đã chốt lương' });
});

test('paid leave left never goes below zero', () => {
  assert.equal(leaveLeft(1, 0), 1);
  assert.equal(leaveLeft(1, 1), 0);
  assert.equal(leaveLeft(2, 3), 0);
});

test('splitting a piece job evenly gives the remainder to the first worker', () => {
  assert.deepEqual(splitEvenly(1_000_000, 3), [333_334, 333_333, 333_333]);
  assert.deepEqual(splitEvenly(900_000, 2), [450_000, 450_000]);
  assert.deepEqual(splitEvenly(500_000, 0), []);
});

test('months move across year boundaries and read as MM/YYYY', () => {
  assert.equal(moveMonth('2026-01', -1), '2025-12');
  assert.equal(moveMonth('2026-12', 1), '2027-01');
  assert.equal(monthLabel('2026-11'), '11/2026');
});
