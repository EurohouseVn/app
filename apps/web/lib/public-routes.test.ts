import assert from 'node:assert/strict';
import test from 'node:test';

import {
  familyRoutes,
  globalNavigationRoutes,
  publicRouteManifest,
  stablePublicRoutes,
} from './public-routes';

test('public route manifest contains every approved root route', () => {
  const canonicalPaths = new Set(publicRouteManifest.map((route) => route.canonicalPath));

  for (const path of [
    '/',
    '/nhom-dan-dung',
    '/nhom-cong-nghiep',
    '/du-an',
    '/nang-luc',
    '/tai-nguyen',
    '/nha-phan-phoi',
    '/lien-he',
    '/tim-kiem',
  ]) {
    assert.ok(canonicalPaths.has(path), `Missing approved root route: ${path}`);
  }
});

test('navigation exposes exactly the two approved product families', () => {
  assert.deepEqual(
    familyRoutes.map(({ family, label, canonicalPath }) => ({ family, label, canonicalPath })),
    [
      {
        family: 'RESIDENTIAL',
        label: 'NHÔM DÂN DỤNG',
        canonicalPath: '/nhom-dan-dung',
      },
      {
        family: 'INDUSTRIAL',
        label: 'NHÔM CÔNG NGHIỆP',
        canonicalPath: '/nhom-cong-nghiep',
      },
    ],
  );

  assert.deepEqual(
    globalNavigationRoutes.filter((route) => route.kind === 'family'),
    familyRoutes,
  );
});

test('stable support and legal routes remain canonical', () => {
  assert.deepEqual(
    stablePublicRoutes.map((route) => route.canonicalPath),
    ['/support', '/privacy', '/terms', '/delete-account'],
  );
});

test('canonical paths are unique and NPP uses the approved external entry', () => {
  const canonicalPaths = publicRouteManifest.map((route) => route.canonicalPath);
  assert.equal(new Set(canonicalPaths).size, canonicalPaths.length);

  const nppEntry = publicRouteManifest.find((route) => route.id === 'npp-sign-in');
  assert.equal(nppEntry?.href, 'https://npp.nhomeurohouse.com');
  assert.equal(nppEntry?.external, true);
});
