import assert from 'node:assert/strict';
import test from 'node:test';
import { serializePublishedWebsiteContent } from './public-website-content.serializer';

function sourceFixture() {
  return {
    id: 'content-1',
    slug: 'he-cua-eu55',
    locale: 'vi',
    kind: 'PRODUCT',
    family: 'RESIDENTIAL',
    updatedAt: new Date('2026-10-31T01:00:00.000Z'),
    internalNotes: 'SECRET_ADMIN_NOTE',
    aluSystem: {
      id: 'system-eu55',
      code: 'EU55',
      name: 'EUROHOUSE EU55',
      profiles: [{ code: 'EU55-K', pricePerKg: 123456, stockBars: 999 }],
    },
    revisions: [
      {
        id: 'revision-draft',
        revision: 3,
        status: 'DRAFT',
        title: 'SECRET_DRAFT_TITLE',
        eyebrow: 'Bản nháp',
        summary: 'Không được lộ.',
        body: { secret: 'SECRET_DRAFT_BODY' },
        specifications: { secret: 'SECRET_DRAFT_SPEC' },
        sourceRefs: [{ adminOnly: 'SECRET_SOURCE' }],
        updatedAt: new Date('2026-10-31T03:00:00.000Z'),
        reviews: [{ note: 'SECRET_REVIEW_NOTE' }],
        seo: null,
        media: [],
        documents: [],
      },
      {
        id: 'revision-published-old',
        revision: 1,
        status: 'PUBLISHED',
        title: 'Tiêu đề cũ',
        summary: 'Bản cũ.',
        body: { blocks: [] },
        updatedAt: new Date('2026-10-30T01:00:00.000Z'),
        seo: null,
        media: [],
        documents: [],
      },
      {
        id: 'revision-published',
        revision: 2,
        status: 'PUBLISHED',
        title: 'Hệ cửa EUROHOUSE EU55',
        eyebrow: 'Nhôm dân dụng',
        summary: 'Giải pháp cửa đồng bộ cho công trình.',
        body: { blocks: [{ type: 'paragraph', text: 'Nội dung công khai.' }] },
        specifications: { thickness: '1.4 mm' },
        sourceRefs: [{ source: 'SECRET_SOURCE_REF' }],
        updatedAt: new Date('2026-10-31T02:00:00.000Z'),
        reviews: [{ note: 'SECRET_APPROVAL_NOTE' }],
        seo: {
          title: 'Hệ cửa nhôm EUROHOUSE EU55',
          description: 'Thông số và ứng dụng hệ cửa EU55.',
          canonicalPath: '/nhom-dan-dung/he-cua-eu55',
          schemaType: 'Product',
          reviewDate: new Date('2026-10-31T00:00:00.000Z'),
          reviewer: { displayName: 'Phòng kỹ thuật' },
          privateKeywordPlan: 'SECRET_KEYWORDS',
        },
        media: [
          {
            role: 'HERO',
            sortOrder: 0,
            mediaAsset: {
              id: 'media-public',
              mediaType: 'IMAGE',
              channels: ['PUBLIC'],
              altText: 'Mặt cắt hệ EU55',
              caption: 'Cấu trúc thanh nhôm.',
              transcript: null,
              storageObject: {
                publicUrl: '/static/eu55.webp',
                objectKey: 'SECRET_STORAGE_KEY_PUBLIC',
                sha256: 'SECRET_HASH',
                metadata: { width: 1600, height: 900 },
              },
              posterStorageObject: null,
            },
          },
          {
            role: 'INTERNAL',
            sortOrder: 1,
            mediaAsset: {
              id: 'media-admin',
              mediaType: 'IMAGE',
              channels: ['ADMIN_ONLY'],
              altText: 'SECRET_ADMIN_MEDIA',
              storageObject: { publicUrl: '/secret/admin.webp', objectKey: 'SECRET_ADMIN_KEY' },
              posterStorageObject: null,
            },
          },
        ],
        documents: [
          {
            sortOrder: 0,
            document: {
              id: 'doc-public',
              title: 'Tài liệu kỹ thuật EU55',
              documentType: 'TECHNICAL_DATASHEET',
              revisionLabel: 'R19',
              effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
              channels: ['PUBLIC'],
              storageObject: { publicUrl: '/static/eu55.pdf', objectKey: 'SECRET_DOC_KEY' },
            },
          },
          {
            sortOrder: 1,
            document: {
              id: 'doc-npp',
              title: 'SECRET_NPP_DOCUMENT',
              documentType: 'PRICE_LIST',
              revisionLabel: 'R1',
              effectiveDate: new Date('2026-10-01T00:00:00.000Z'),
              channels: ['NPP'],
              storageObject: { publicUrl: '/secret/npp.pdf', objectKey: 'SECRET_NPP_KEY' },
            },
          },
        ],
      },
    ],
    publicationAudits: [{ note: 'SECRET_AUDIT_NOTE' }],
  };
}

test('public serializer selects the latest published revision and exposes only allowlisted keys', () => {
  const result = serializePublishedWebsiteContent(sourceFixture());
  assert.ok(result);
  assert.deepEqual(Object.keys(result), [
    'id',
    'slug',
    'locale',
    'kind',
    'family',
    'title',
    'eyebrow',
    'summary',
    'updatedAt',
    'linkedSystem',
    'body',
    'specifications',
    'seo',
    'media',
    'documents',
  ]);
  assert.equal(result.title, 'Hệ cửa EUROHOUSE EU55');
  assert.deepEqual(result.linkedSystem, { id: 'system-eu55', code: 'EU55', name: 'EUROHOUSE EU55' });
});

test('public serializer excludes drafts, operational pricing, storage keys, reviews, audits and non-public assets', () => {
  const result = serializePublishedWebsiteContent(sourceFixture());
  assert.ok(result);
  assert.deepEqual(result.media.map((item) => item.id), ['media-public']);
  assert.equal((result.media[0] as { role?: string }).role, 'HERO');
  assert.deepEqual(result.documents.map((item) => item.id), ['doc-public']);

  const serialized = JSON.stringify(result);
  for (const secret of [
    'SECRET_DRAFT',
    'SECRET_SOURCE',
    'SECRET_REVIEW',
    'SECRET_APPROVAL',
    'SECRET_AUDIT',
    'SECRET_STORAGE',
    'SECRET_ADMIN',
    'SECRET_NPP',
    'SECRET_KEYWORDS',
    'pricePerKg',
    'stockBars',
    'objectKey',
    'sha256',
  ]) {
    assert.equal(serialized.includes(secret), false, `must not expose ${secret}`);
  }
});

test('public serializer returns null when no published revision exists', () => {
  const source = sourceFixture();
  source.revisions = source.revisions.filter((revision) => revision.status !== 'PUBLISHED');
  assert.equal(serializePublishedWebsiteContent(source), null);
});
