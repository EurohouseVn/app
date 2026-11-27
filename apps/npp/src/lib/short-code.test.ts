import assert from 'node:assert/strict';
import test from 'node:test';
import { shortCode } from './short-code';

test('order codes lose the generic prefix', () => {
  assert.equal(shortCode('XUONG-HUNGPHAT-261127-01'), 'HUNGPHAT-261127-01');
  assert.equal(shortCode('CSSX-MINHKHANG-261122-01'), 'MINHKHANG-261122-01');
  assert.equal(shortCode('NPP-MIENNAM-261127-02'), 'MIENNAM-261127-02');
});

test('factory codes lose the prefix', () => {
  assert.equal(shortCode('XUONG-HUNGPHAT'), 'HUNGPHAT');
});

test('a prefix is kept when stripping would leave a meaningless number', () => {
  assert.equal(shortCode('XUONG-01'), 'XUONG-01');
  assert.equal(shortCode('XUONG-01-261126-01'), 'XUONG-01-261126-01');
});

test('other codes and empty values are left alone', () => {
  assert.equal(shortCode('BG-261127-01'), 'BG-261127-01');
  assert.equal(shortCode(''), '');
  assert.equal(shortCode(null), '-');
  assert.equal(shortCode(undefined), '-');
});
