import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEBSITE_CHANNELS,
  WEBSITE_CONTENT_KINDS,
  WEBSITE_MEDIA_INTAKE_STATUSES,
  WEBSITE_PRODUCT_FAMILIES,
  WEBSITE_PUBLICATION_STATUSES,
  WEBSITE_REVIEW_STAGES,
  type AdminWebsiteRevision,
  type PublicWebsiteContentDetail,
} from './index.ts';

test('website taxonomy has exactly two roots and three visibility channels', () => {
  assert.deepEqual(WEBSITE_PRODUCT_FAMILIES, ['RESIDENTIAL', 'INDUSTRIAL']);
  assert.deepEqual(WEBSITE_CHANNELS, ['PUBLIC', 'NPP', 'ADMIN_ONLY']);
});

test('website workflow constants expose the approved bounded values', () => {
  assert.deepEqual(WEBSITE_PUBLICATION_STATUSES, [
    'DRAFT',
    'TECHNICAL_REVIEW',
    'MARKETING_REVIEW',
    'PUBLISHED',
    'ARCHIVED',
  ]);
  assert.deepEqual(WEBSITE_REVIEW_STAGES, ['TECHNICAL', 'MARKETING']);
  assert.deepEqual(WEBSITE_MEDIA_INTAKE_STATUSES, [
    'DISCOVERED',
    'REVIEWED',
    'APPROVED',
    'OPTIMIZED',
    'PUBLISHED',
    'REJECTED',
  ]);
  assert.ok(WEBSITE_CONTENT_KINDS.includes('PRODUCT'));
  assert.ok(WEBSITE_CONTENT_KINDS.includes('INDUSTRIAL_SERVICE'));
});

test('public and Admin revision contracts remain structurally separate', () => {
  const publicDetail: PublicWebsiteContentDetail = {
    id: 'content-1',
    slug: 'ecento-70',
    locale: 'vi',
    kind: 'PRODUCT',
    family: 'RESIDENTIAL',
    title: 'ECENTO 70',
    summary: 'Hệ nhôm dân dụng EUROHOUSE.',
    updatedAt: '2026-10-31T00:00:00.000Z',
    body: { blocks: [] },
    seo: {
      title: 'ECENTO 70 | EUROHOUSE',
      description: 'Thông tin kỹ thuật Ecento 70.',
      canonicalPath: '/nhom-dan-dung/dong-san-pham/ecento-70',
      schemaType: 'Product',
    },
    media: [],
    documents: [],
  };
  const adminRevision: AdminWebsiteRevision = {
    id: 'revision-1',
    websiteContentId: publicDetail.id,
    revision: 1,
    status: 'DRAFT',
    title: publicDetail.title,
    summary: publicDetail.summary,
    body: publicDetail.body,
    createdAt: publicDetail.updatedAt,
    updatedAt: publicDetail.updatedAt,
    reviews: [],
  };

  assert.equal(publicDetail.title, adminRevision.title);
  assert.equal('reviews' in publicDetail, false);
  assert.equal(adminRevision.status, 'DRAFT');
});
