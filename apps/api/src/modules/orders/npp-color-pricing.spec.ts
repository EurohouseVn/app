import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { calculateNppColorPricing } from './npp-color-pricing';

const theo = { CAFE_METALIC: 300, XAM_NGOC_TRAI: 200, VAN_GO_CAM_LAI: 100 };

test('prices every colour on its own two lines: whole bundles and bare aluminium', () => {
  const result = calculateNppColorPricing({
    theoreticalKgByColor: theo,
    lines: [
      { colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 200, unitPricePerKg: 90000 },
      { colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 105.5, unitPricePerKg: 86000 },
      { colorCode: 'XAM_NGOC_TRAI', basis: 'BUNDLE', actualKg: 204, unitPricePerKg: 92000 },
      { colorCode: 'VAN_GO_CAM_LAI', basis: 'BARE', actualKg: 101, unitPricePerKg: 99000 },
    ],
  });
  assert.equal(result.actualTotalKg, 610.5);
  assert.equal(result.subtotalAmount, 200 * 90000 + Math.round(105.5 * 86000) + 204 * 92000 + 101 * 99000);
  assert.equal(result.finalTotalAmount, result.subtotalAmount);
  assert.equal(result.finalUnitPricePerKg, Math.round(result.subtotalAmount / 610.5));
  assert.deepEqual(result.colorTotals.map((c) => [c.colorCode, c.actualKg, c.amount]), [
    ['CAFE_METALIC', 305.5, 18000000 + 9073000],
    ['XAM_NGOC_TRAI', 204, 18768000],
    ['VAN_GO_CAM_LAI', 101, 9999000],
  ]);
});

test('applies discount and surcharge on the order total', () => {
  const result = calculateNppColorPricing({
    theoreticalKgByColor: { CAFE_METALIC: 100 },
    lines: [{ colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 100, unitPricePerKg: 80000 }],
    discountAmount: 100000,
    surchargeAmount: 50000,
  });
  assert.equal(result.finalTotalAmount, 8000000 - 100000 + 50000);
});

test('rejects a colour weighed below its theoretical weight', () => {
  assert.throws(
    () => calculateNppColorPricing({
      theoreticalKgByColor: { CAFE_METALIC: 300 },
      lines: [{ colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 250, unitPricePerKg: 90000 }],
    }),
    (error: unknown) => error instanceof BadRequestException && /CAFE_METALIC/.test(String((error as Error).message)),
  );
});

test('rejects an order colour that has no weight line', () => {
  assert.throws(
    () => calculateNppColorPricing({
      theoreticalKgByColor: { CAFE_METALIC: 100, XAM_NGOC_TRAI: 50 },
      lines: [{ colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 100, unitPricePerKg: 90000 }],
    }),
    BadRequestException,
  );
});

test('rejects unknown colours, duplicate lines and missing prices', () => {
  const base = { theoreticalKgByColor: { CAFE_METALIC: 100 } };
  assert.throws(() => calculateNppColorPricing({ ...base, lines: [{ colorCode: 'DO', basis: 'BARE', actualKg: 10, unitPricePerKg: 1 }] }), BadRequestException);
  assert.throws(() => calculateNppColorPricing({ ...base, lines: [
    { colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 60, unitPricePerKg: 80000 },
    { colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 60, unitPricePerKg: 80000 },
  ] }), BadRequestException);
  assert.throws(() => calculateNppColorPricing({ ...base, lines: [{ colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 100, unitPricePerKg: 0 }] }), BadRequestException);
});

test('ignores empty lines so one colour can use only one of the two prices', () => {
  const result = calculateNppColorPricing({
    theoreticalKgByColor: { CAFE_METALIC: 100 },
    lines: [
      { colorCode: 'CAFE_METALIC', basis: 'BUNDLE', actualKg: 0, unitPricePerKg: 0 },
      { colorCode: 'CAFE_METALIC', basis: 'BARE', actualKg: 101, unitPricePerKg: 80000 },
    ],
  });
  assert.equal(result.lines.length, 1);
  assert.equal(result.lines[0].basis, 'BARE');
});
