import assert from 'node:assert/strict';
import test from 'node:test';
import { formatVndInput, parseVndInput } from './vndCurrency.ts';

test('formats Vietnamese currency input with dot thousands separators', () => {
  assert.equal(formatVndInput('455000000'), '455.000.000');
  assert.equal(formatVndInput('0001250000'), '1.250.000');
  assert.equal(formatVndInput('0'), '0');
});

test('parses formatted Vietnamese currency back to an integer', () => {
  assert.equal(parseVndInput('455.000.000 đ'), 455_000_000);
  assert.equal(parseVndInput(''), 0);
});
