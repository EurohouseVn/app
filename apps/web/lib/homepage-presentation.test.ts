import assert from 'node:assert/strict';
import test from 'node:test';

import {
  brandAssets,
  homepageCopy,
  residentialFallbackSystems,
} from './homepage-presentation';

test('uses the approved complete EUROHOUSE landscape logo', () => {
  assert.equal(brandAssets.logo, '/brand/eurohouse-logo-landscape.png');
  assert.equal(brandAssets.logoAlt, 'EUROHOUSE — Nhôm của sự thịnh vượng');
});

test('homepage copy speaks to customers and trades instead of publication workflow', () => {
  const copy = JSON.stringify(homepageCopy).toLocaleLowerCase('vi');

  for (const forbidden of [
    'chưa được duyệt',
    'được phê duyệt',
    'cần xác nhận',
    'hành trình tư vấn',
    'công suất',
    'tấn/năm',
    'chứng nhận đạt',
    'số 1',
  ]) {
    assert.equal(copy.includes(forbidden), false, `customer-facing copy must not contain: ${forbidden}`);
  }

  for (const expected of ['nhà ở', 'thợ', 'bản vẽ', 'gia công']) {
    assert.equal(copy.includes(expected), true, `customer-facing copy should mention: ${expected}`);
  }
});

test('monumental homepage copy connects premium systems with industrial capability', () => {
  assert.equal(homepageCopy.hero.title, 'Định hình không gian. Kiến tạo sản xuất.');
  assert.match(homepageCopy.hero.lead, /nhôm hệ cao cấp/i);
  assert.match(homepageCopy.hero.lead, /nhôm định hình/i);
  assert.deepEqual(
    homepageCopy.industrial.services.map((item) => item.href),
    [
      '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve',
      '/nhom-cong-nghiep/chi-tiet-may',
      '/nhom-cong-nghiep/nang-luong-mat-troi',
      '/nhom-cong-nghiep/dun-thue',
      '/nhom-cong-nghiep/gia-cong',
    ],
  );
});

test('fallback system cards use verified real-product photography instead of faulty renders', () => {
  assert.deepEqual(
    residentialFallbackSystems.map((system) => system.image),
    [
      '/images/v4/ecento-70.jpg',
      '/images/v4/ecento-plus.jpg',
      '/images/v4/he-55-vat-canh.jpg',
    ],
  );
  assert.equal(residentialFallbackSystems.every((system) => !system.image.includes('/images/v5/product-')), true);
});
