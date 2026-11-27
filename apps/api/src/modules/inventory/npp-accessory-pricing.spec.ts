import assert from 'node:assert/strict';
import test from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { computeAccessorySalePrice, normalizeMarkupPercent } from './npp-accessory-pricing';

test('automatic price adds the markup and rounds up to the nearest 1.000 đ', () => {
  assert.equal(computeAccessorySalePrice({ unitCost: 185000, markupPercent: 20, mode: 'AUTO', manualPrice: 0 }), 222000);
  assert.equal(computeAccessorySalePrice({ unitCost: 52000, markupPercent: 25, mode: 'AUTO', manualPrice: 0 }), 65000);
  assert.equal(computeAccessorySalePrice({ unitCost: 10001, markupPercent: 0, mode: 'AUTO', manualPrice: 0 }), 11000);
});

test('automatic price is zero while the cost is unknown', () => {
  assert.equal(computeAccessorySalePrice({ unitCost: 0, markupPercent: 30, mode: 'AUTO', manualPrice: 5000 }), 0);
});

test('manual price is kept exactly as the distributor typed it', () => {
  assert.equal(computeAccessorySalePrice({ unitCost: 185000, markupPercent: 20, mode: 'MANUAL', manualPrice: 199500 }), 199500);
});

test('markup percent must be a number from 0 to 500', () => {
  assert.equal(normalizeMarkupPercent(20), 20);
  assert.equal(normalizeMarkupPercent('12.5'), 12.5);
  assert.throws(() => normalizeMarkupPercent(-1), BadRequestException);
  assert.throws(() => normalizeMarkupPercent(501), BadRequestException);
  assert.throws(() => normalizeMarkupPercent('abc'), BadRequestException);
});
