import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HOMEPAGE_BODY_SECTION_KEYS,
  HOMEPAGE_EDITOR_SECTION_KEYS,
  HOMEPAGE_MEDIA_ROLES,
  HOMEPAGE_SCHEMA_VERSION,
  WEBSITE_FAMILY_ROUTES,
  WEBSITE_PERMISSIONS,
  type HomepagePayloadV1,
  type HomepageSaveInput,
} from './website-homepage.ts';
import * as packageContracts from './index.ts';

test('homepage contract exposes the fixed body and editor sections', () => {
  assert.deepEqual(HOMEPAGE_BODY_SECTION_KEYS, [
    'hero',
    'productFields',
    'residential',
    'industrial',
    'evidence',
    'projects',
    'video',
    'contact',
  ]);
  assert.deepEqual(HOMEPAGE_EDITOR_SECTION_KEYS, [...HOMEPAGE_BODY_SECTION_KEYS, 'seo']);
  assert.equal(HOMEPAGE_SCHEMA_VERSION, 1);
});

test('homepage media roles and family routes are bounded', () => {
  assert.deepEqual(HOMEPAGE_MEDIA_ROLES, [
    'HERO_BACKGROUND',
    'FIELD_RESIDENTIAL',
    'FIELD_INDUSTRIAL',
    'INDUSTRIAL_BACKGROUND',
    'EVIDENCE_1',
    'EVIDENCE_2',
    'EVIDENCE_3',
    'EVIDENCE_4',
    'VIDEO_PRIMARY',
    'SOCIAL_SHARE',
  ]);
  assert.deepEqual(WEBSITE_FAMILY_ROUTES, {
    RESIDENTIAL: '/nhom-dan-dung',
    INDUSTRIAL: '/nhom-cong-nghiep',
  });
});

test('website permissions use stable server-facing keys', () => {
  assert.deepEqual(WEBSITE_PERMISSIONS, {
    module: 'website',
    reviewTechnical: 'website-review-technical',
    reviewMarketing: 'website-review-marketing',
    approveMedia: 'website-media-approve',
    publish: 'website-publish',
  });
});

test('homepage save input keeps SEO separate and carries concurrency identity', () => {
  const payload = { schemaVersion: 1 } as HomepagePayloadV1;
  const input: HomepageSaveInput = {
    payload,
    expectedUpdatedAt: '2026-11-06T00:00:00.000Z',
    seo: {
      title: 'Nhôm Eurohouse',
      description: 'Nhôm kiến trúc và nhôm công nghiệp EUROHOUSE.',
      canonicalPath: '/',
      schemaType: 'WebPage',
    },
    mediaByRole: {},
  };

  assert.equal('seo' in payload, false);
  assert.equal(input.expectedUpdatedAt, '2026-11-06T00:00:00.000Z');
});

test('package entry point exposes the same runtime contract', () => {
  assert.deepEqual(packageContracts.HOMEPAGE_BODY_SECTION_KEYS, HOMEPAGE_BODY_SECTION_KEYS);
  assert.deepEqual(packageContracts.HOMEPAGE_MEDIA_ROLES, HOMEPAGE_MEDIA_ROLES);
  assert.deepEqual(packageContracts.WEBSITE_PERMISSIONS, WEBSITE_PERMISSIONS);
});
