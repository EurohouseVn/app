import test from 'node:test';
import assert from 'node:assert/strict';
import { getIndexableRoutes } from './indexable-routes';

test('indexable routes cover both pillars and their concrete content pages', () => {
  const paths: string[] = getIndexableRoutes().map((route) => route.path);

  for (const expected of [
    '/',
    '/nhom-dan-dung',
    '/nhom-cong-nghiep',
    '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve',
    '/nhom-cong-nghiep/chi-tiet-may',
    '/nhom-cong-nghiep/nang-luong-mat-troi',
    '/nhom-cong-nghiep/dun-thue',
    '/nhom-cong-nghiep/gia-cong',
    '/nhom-dan-dung/dong-san-pham/ecento-70',
    '/nhom-dan-dung/he-chuyen-dung/mat-dung',
    '/kien-thuc/cach-chuan-bi-ban-ve-nhom-cong-nghiep',
    '/ve-eurohouse',
  ]) assert.ok(paths.includes(expected), `missing ${expected}`);
});

test('indexable routes exclude utilities, templates, filters, portals and duplicates', () => {
  const routes = getIndexableRoutes();
  const paths: string[] = routes.map((route) => route.path);

  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.some((path) => path.includes('[') || path.includes(']')), false);
  assert.equal(paths.some((path) => path.includes('?')), false);
  assert.equal(paths.some((path) => path.startsWith('http') || path.startsWith('/api')), false);
  for (const excluded of ['/tim-kiem', '/privacy', '/terms', '/support', '/delete-account']) {
    assert.equal(paths.includes(excluded), false, `utility route leaked: ${excluded}`);
  }
  assert.equal(routes.every((route) => ['static', 'product', 'residential', 'industrial', 'knowledge', 'capability', 'video'].includes(route.source)), true);
});
