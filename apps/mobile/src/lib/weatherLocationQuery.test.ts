import assert from 'node:assert/strict';
import test from 'node:test';
import { locationCandidates, pickProvinceMatch, sameProvince } from './weatherLocationQuery.ts';

test('a workshop address yields the district inside its province, then the province', () => {
  assert.deepEqual(locationCandidates(undefined, 'Sầm Sơn - Thanh Hoá'), [
    { name: 'Sầm Sơn', province: 'Thanh Hoá' },
    { name: 'Thanh Hoá' },
  ]);
});

test('prefixes and common abbreviations are normalised for the geocoder', () => {
  assert.deepEqual(locationCandidates(undefined, 'Bình Tân, TP.HCM'), [
    { name: 'Bình Tân', province: 'Hồ Chí Minh' },
    { name: 'Hồ Chí Minh' },
  ]);
  assert.deepEqual(locationCandidates('Tỉnh Thanh Hóa', ''), [{ name: 'Thanh Hóa' }]);
  assert.deepEqual(locationCandidates('Thành phố Hà Nội', undefined), [{ name: 'Hà Nội' }]);
});

test('a saved province wins over a free-text address and is tried with the district', () => {
  assert.deepEqual(locationCandidates('Hưng Yên', '12 Lê Lợi, Phường An Tảo, Hưng Yên'), [
    { name: 'An Tảo', province: 'Hưng Yên' },
    { name: 'Hưng Yên' },
  ]);
});

test('house numbers and street lines are skipped; empty input yields nothing', () => {
  assert.deepEqual(locationCandidates(undefined, '25 Nguyễn Văn Linh, Quận 7, TP. Hồ Chí Minh'), [
    { name: 'Quận 7', province: 'Hồ Chí Minh' },
    { name: 'Hồ Chí Minh' },
  ]);
  assert.deepEqual(locationCandidates(undefined, ''), []);
  assert.deepEqual(locationCandidates(null, null), []);
});

test('province comparison ignores accents, spacing and "Thành phố" prefixes', () => {
  assert.equal(sameProvince('Thành phố Hồ Chí Minh', 'Hồ Chí Minh'), true);
  assert.equal(sameProvince('Hanoi', 'Hà Nội'), true);
  assert.equal(sameProvince('Thanh Hóa', 'Thanh Hoá'), true);
  assert.equal(sameProvince('Thanh Hóa', 'Hồ Chí Minh'), false);
});

test('a district match is only accepted when it lies in the expected province', () => {
  const results = [
    { name: 'Bình Tân', admin1: 'Thanh Hóa' },
    { name: 'Bình Tân', admin1: 'Thành phố Hồ Chí Minh' },
  ];
  assert.equal(pickProvinceMatch(results, 'Hồ Chí Minh')?.admin1, 'Thành phố Hồ Chí Minh');
  assert.equal(pickProvinceMatch([{ name: 'Bình Tân', admin1: 'Thanh Hóa' }], 'Hồ Chí Minh'), undefined);
  assert.equal(pickProvinceMatch(results, undefined)?.admin1, 'Thanh Hóa');
});
