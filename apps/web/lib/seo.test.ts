import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteUrl, buildPageMetadata } from './seo';

test('absoluteUrl resolves public paths against the production origin', () => {
  assert.equal(absoluteUrl('/nhom-cong-nghiep'), 'https://nhomeurohouse.com/nhom-cong-nghiep');
  assert.equal(absoluteUrl('https://nhomeurohouse.com/kien-thuc'), 'https://nhomeurohouse.com/kien-thuc');
});

test('buildPageMetadata creates one canonical title and page-specific sharing metadata', () => {
  const metadata = buildPageMetadata({
    title: 'Nhôm công nghiệp | Eurohouse',
    description: 'Nhôm định hình theo bản vẽ, đùn thuê và gia công cho doanh nghiệp sản xuất.',
    canonicalPath: '/nhom-cong-nghiep',
    image: '/images/v5/factory-coating.webp',
    imageAlt: 'Nhà máy nhôm công nghiệp Eurohouse',
  });

  assert.equal(metadata.title, 'Nhôm công nghiệp');
  assert.equal(metadata.alternates?.canonical, 'https://nhomeurohouse.com/nhom-cong-nghiep');
  assert.equal(metadata.openGraph?.title, 'Nhôm công nghiệp | Eurohouse');
  assert.equal(metadata.openGraph?.description, 'Nhôm định hình theo bản vẽ, đùn thuê và gia công cho doanh nghiệp sản xuất.');
  assert.deepEqual(metadata.openGraph?.images, [{
    url: 'https://nhomeurohouse.com/images/v5/factory-coating.webp',
    alt: 'Nhà máy nhôm công nghiệp Eurohouse',
  }]);
  assert.equal(metadata.twitter?.title, 'Nhôm công nghiệp | Eurohouse');
  assert.equal(metadata.twitter?.description, 'Nhôm định hình theo bản vẽ, đùn thuê và gia công cho doanh nghiệp sản xuất.');
  assert.deepEqual(metadata.twitter?.images, ['https://nhomeurohouse.com/images/v5/factory-coating.webp']);
});

test('buildPageMetadata rejects empty descriptions and foreign canonical origins', () => {
  assert.throws(() => buildPageMetadata({
    title: 'Trang lỗi',
    description: '   ',
    canonicalPath: '/trang-loi',
    image: '/images/v4/hero-project.jpg',
    imageAlt: 'Eurohouse',
  }), /description/i);

  assert.throws(() => buildPageMetadata({
    title: 'Trang lỗi',
    description: 'Mô tả hợp lệ.',
    canonicalPath: 'https://example.com/trang-loi',
    image: '/images/v4/hero-project.jpg',
    imageAlt: 'Eurohouse',
  }), /canonical/i);
});
