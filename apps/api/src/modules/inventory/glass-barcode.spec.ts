import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGlassBarcode, normalizeBarcodePrefix, parseGlassBarcode } from './glass-barcode';

test('builds PREFIX-WIDTH-HEIGHT with 4-digit zero padded sides', () => {
  assert.equal(buildGlassBarcode('CL8', 2440, 3660), 'CL8-2440-3660');
  assert.equal(buildGlassBarcode('CL8', 600, 900), 'CL8-0600-0900');
  assert.equal(buildGlassBarcode('CL8', 1, 9999), 'CL8-0001-9999');
});

test('shorter side always comes first so one size has one code', () => {
  assert.equal(buildGlassBarcode('CL8', 3660, 2440), 'CL8-2440-3660');
  assert.equal(buildGlassBarcode('CL8', 900, 600), buildGlassBarcode('CL8', 600, 900));
  assert.equal(buildGlassBarcode('CL8', 500, 500), 'CL8-0500-0500');
});

test('fractional millimetres round up to the next whole millimetre', () => {
  assert.equal(buildGlassBarcode('CL8', 599.2, 900.01), 'CL8-0600-0901');
});

test('rejects sides outside 1..9999 mm or not numbers', () => {
  assert.throws(() => buildGlassBarcode('CL8', 0, 900), /kích thước/i);
  assert.throws(() => buildGlassBarcode('CL8', -5, 900), /kích thước/i);
  assert.throws(() => buildGlassBarcode('CL8', 600, 10000), /kích thước/i);
  assert.throws(() => buildGlassBarcode('CL8', Number.NaN, 900), /kích thước/i);
  assert.throws(() => buildGlassBarcode('CL8', Number.POSITIVE_INFINITY, 900), /kích thước/i);
});

test('prefix is trimmed, upper-cased and limited to 2-6 letters or digits', () => {
  assert.equal(normalizeBarcodePrefix(' cl8 '), 'CL8');
  assert.equal(normalizeBarcodePrefix('KINH10'), 'KINH10');
  assert.throws(() => normalizeBarcodePrefix('A'), /mã đầu/i);
  assert.throws(() => normalizeBarcodePrefix('ABCDEFG'), /mã đầu/i);
  assert.throws(() => normalizeBarcodePrefix('CL-8'), /mã đầu/i);
  assert.throws(() => normalizeBarcodePrefix('CƯ8'), /mã đầu/i);
  assert.throws(() => normalizeBarcodePrefix(''), /mã đầu/i);
});

test('buildGlassBarcode applies the same prefix rules', () => {
  assert.equal(buildGlassBarcode('cl8', 600, 900), 'CL8-0600-0900');
  assert.throws(() => buildGlassBarcode('C', 600, 900), /mã đầu/i);
});

test('parses a canonical code back into prefix and sides', () => {
  assert.deepEqual(parseGlassBarcode('CL8-2440-3660'), { prefix: 'CL8', shortMm: 2440, longMm: 3660 });
  assert.deepEqual(parseGlassBarcode('CL8-0600-0900'), { prefix: 'CL8', shortMm: 600, longMm: 900 });
});

test('parse tolerates case and surrounding whitespace from scanners', () => {
  assert.deepEqual(parseGlassBarcode('  cl8-0600-0900\n'), { prefix: 'CL8', shortMm: 600, longMm: 900 });
});

test('parse rejects malformed or non-canonical codes with null', () => {
  assert.equal(parseGlassBarcode(''), null);
  assert.equal(parseGlassBarcode('CL8-600-900'), null);
  assert.equal(parseGlassBarcode('CL8-0900-0600'), null);
  assert.equal(parseGlassBarcode('CL8-0000-0900'), null);
  assert.equal(parseGlassBarcode('CL8-0600-0900-1'), null);
  assert.equal(parseGlassBarcode('C-0600-0900'), null);
  assert.equal(parseGlassBarcode('CL8_0600_0900'), null);
});

test('build then parse round-trips for many sizes', () => {
  for (const [w, h] of [[2440, 3660], [3300, 6000], [300, 300], [1, 1], [9999, 9999], [1200, 800]]) {
    const code = buildGlassBarcode('CL10', w, h);
    const parsed = parseGlassBarcode(code);
    assert.ok(parsed);
    assert.equal(parsed.prefix, 'CL10');
    assert.equal(parsed.shortMm, Math.min(w, h));
    assert.equal(parsed.longMm, Math.max(w, h));
  }
});
