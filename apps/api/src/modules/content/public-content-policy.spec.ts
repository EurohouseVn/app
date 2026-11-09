import assert from 'node:assert/strict';
import test from 'node:test';
import { isPublicPublished, sanitizePublicContent } from './public-content-policy';
import { CatalogService } from '../catalog/catalog.service';

const now = new Date('2026-11-09T08:00:00.000Z');

test('publication policy rejects draft, archived, scheduled, expired, and restricted records', () => {
  assert.equal(isPublicPublished({ status: 'PUBLISHED', active: true }, now), true);
  assert.equal(isPublicPublished({ status: 'DRAFT', active: true }, now), false);
  assert.equal(isPublicPublished({ status: 'ARCHIVED', active: true }, now), false);
  assert.equal(isPublicPublished({ active: false }, now), false);
  assert.equal(isPublicPublished({ isShared: false }, now), false);
  assert.equal(isPublicPublished({ active: true, startDate: '2026-11-10T00:00:00.000Z' }, now), false);
  assert.equal(isPublicPublished({ active: true, endDate: '2026-11-09T07:59:59.000Z' }, now), false);
  assert.equal(isPublicPublished({ active: true, accessLevel: 'RESTRICTED' }, now), false);
});

test('publication is re-evaluated so a stale cached revision cannot remain public', () => {
  const cachedRecord: Record<string, unknown> = { status: 'PUBLISHED', active: true };
  assert.equal(isPublicPublished(cachedRecord, now), true);
  cachedRecord.status = 'ARCHIVED';
  assert.equal(isPublicPublished(cachedRecord, now), false);
});

test('public sanitizer whitelists presentation fields and normalizes safe media only', () => {
  const sanitized = sanitizePublicContent({
    id: 'article-1',
    title: '  Kỹ thuật nhôm Eurohouse  ',
    content: 'Nội dung hữu ích',
    imageUrl: '   ',
    bannerUrl: `https://cdn.example/${'x'.repeat(2100)}`,
    mediaUrl: '/static/catalog/eurohouse.pdf',
    gallery: JSON.stringify(['https://cdn.example/one.jpg', '', 'javascript:alert(1)']),
    status: 'PUBLISHED',
    internalNotes: 'không công khai',
    supplierCost: 120,
    createdById: 'admin-1',
  });

  assert.equal(sanitized.title, 'Kỹ thuật nhôm Eurohouse');
  assert.equal(sanitized.mediaUrl, '/static/catalog/eurohouse.pdf');
  assert.deepEqual(sanitized.gallery, ['https://cdn.example/one.jpg']);
  assert.equal('imageUrl' in sanitized, false);
  assert.equal('bannerUrl' in sanitized, false);
  assert.equal('status' in sanitized, false);
  assert.equal('internalNotes' in sanitized, false);
  assert.equal('supplierCost' in sanitized, false);
  assert.equal('createdById' in sanitized, false);
});

test('public catalog keeps product presentation and order keys without leaking commercial or stock fields', async () => {
  const service = new CatalogService({
    aluSystem: {
      findMany: async () => [{
        id: 'system-55', code: 'EU-55', name: 'Hệ 55', description: 'Cửa đi và cửa sổ',
        createdAt: now, updatedAt: now,
        profiles: [{
          id: 'profile-kh01', aluSystemId: 'system-55', code: 'KH01', name: 'Khung bao',
          thicknessMm: '1.2', kgPerMeter: 0.72, barLengthMm: 6000, barsPerBundle: 8,
          pricePerKg: 99_000, stockBars: 250, lowStockAlert: 20, supplierCost: 80_000,
          imageUrl: '/static/profiles/KH01.png', createdAt: now, updatedAt: now,
        }],
      }],
    },
  } as never);

  const result = await service.catalog();
  const profile = result[0].profiles[0] as any;
  assert.equal(profile.id, 'profile-kh01');
  assert.equal(profile.code, 'KH01');
  assert.equal(profile.name, 'Khung bao');
  assert.equal(profile.imageUrl, '/static/profiles/KH01.png');
  for (const forbidden of ['pricePerKg', 'stockBars', 'lowStockAlert', 'supplierCost', 'aluSystemId', 'createdAt', 'updatedAt']) {
    assert.equal(forbidden in profile, false, `${forbidden} must not be public`);
  }
});
