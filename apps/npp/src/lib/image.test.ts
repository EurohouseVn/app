import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleToFit } from './image';

test('big photos are scaled so the longest side is the limit, keeping the proportions', () => {
  assert.deepEqual(scaleToFit(4000, 3000, 1600), { width: 1600, height: 1200 });
  assert.deepEqual(scaleToFit(3000, 4000, 1600), { width: 1200, height: 1600 });
  assert.deepEqual(scaleToFit(4032, 1816, 1600), { width: 1600, height: 721 }); // 1816 × 1600 / 4032 = 720,6
});

test('photos already small enough are left alone', () => {
  assert.deepEqual(scaleToFit(1280, 720, 1600), { width: 1280, height: 720 });
  assert.deepEqual(scaleToFit(1600, 1600, 1600), { width: 1600, height: 1600 });
});

test('a degenerate size is rejected and a very thin strip never becomes zero pixels', () => {
  assert.throws(() => scaleToFit(0, 100, 1600), /không hợp lệ/);
  assert.throws(() => scaleToFit(100, Number.NaN, 1600), /không hợp lệ/);
  assert.deepEqual(scaleToFit(20000, 5, 1600), { width: 1600, height: 1 });
});
