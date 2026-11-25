import test from 'node:test';
import assert from 'node:assert/strict';
import { previewGlassBarcode } from './glassBarcode';
// Nguồn chuẩn nằm ở API; test này giữ bản web luôn khớp với bản API.
import { buildGlassBarcode } from '../../../api/src/modules/inventory/glass-barcode';

test('web preview equals the API barcode for many inputs', () => {
  const prefixes = ['CL8', 'kd5', ' tem10 '];
  const sides: Array<[number, number]> = [[2440, 3660], [3660, 2440], [600, 900], [599.2, 900.01], [1, 9999], [500, 500]];
  for (const prefix of prefixes) {
    for (const [w, h] of sides) {
      assert.equal(previewGlassBarcode(prefix, w, h), buildGlassBarcode(prefix, w, h));
    }
  }
});

test('web preview returns null instead of throwing for invalid input', () => {
  assert.equal(previewGlassBarcode('C', 600, 900), null);
  assert.equal(previewGlassBarcode('CL8', 0, 900), null);
  assert.equal(previewGlassBarcode('CL8', 600, 10000), null);
  assert.equal(previewGlassBarcode('CL8', Number.NaN, 900), null);
  assert.equal(previewGlassBarcode('', 600, 900), null);
});
