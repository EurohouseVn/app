import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildArticleSchema,
  buildBreadcrumbSchema,
  buildFaqSchema,
  buildOrganizationSchema,
  buildProductSchema,
  buildServiceSchema,
  buildWebsiteSchema,
} from './structured-data';

test('organization and website use the verified Eurohouse identity and absolute URLs', () => {
  const organization = buildOrganizationSchema({ sameAs: ['https://www.youtube.com/@eurohouse'] });
  assert.equal(organization.name, 'EUROHOUSE');
  assert.equal(organization.legalName, 'EUROHOUSE VIỆT NAM');
  assert.equal(organization.url, 'https://nhomeurohouse.com');
  assert.equal(organization.logo, 'https://nhomeurohouse.com/brand/eurohouse-logo-landscape.png');
  assert.deepEqual(organization.sameAs, ['https://www.youtube.com/@eurohouse']);

  const withoutProfiles = buildOrganizationSchema();
  assert.equal('sameAs' in withoutProfiles, false);

  const website = buildWebsiteSchema();
  assert.equal(website.url, 'https://nhomeurohouse.com');
  assert.equal(website.publisher['@id'], 'https://nhomeurohouse.com/#organization');
});

test('breadcrumb URLs are absolute and positions are sequential', () => {
  const schema = buildBreadcrumbSchema([
    { label: 'Trang chủ', href: '/' },
    { label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' },
    { label: 'Gia công sản phẩm nhôm' },
  ]);

  assert.deepEqual(schema.itemListElement.map((item) => item.position), [1, 2, 3]);
  assert.equal(schema.itemListElement[0]?.item, 'https://nhomeurohouse.com/');
  assert.equal(schema.itemListElement[2]?.item, undefined);
});

test('product schema includes required public fields and omits unverified properties', () => {
  const schema = buildProductSchema({
    name: 'ECENTO 70',
    description: 'Hệ nhôm kiến trúc cao cấp.',
    url: '/san-pham/ecento-70',
    image: '/images/products/ecento-70.jpg',
    category: 'Dòng sản phẩm',
    sku: 'EU-70',
    properties: [
      { name: 'Mã hệ', value: 'EU-70', verified: true },
      { name: 'Tải trọng', value: 'Chưa duyệt', verified: false },
    ],
  });

  assert.equal(schema.url, 'https://nhomeurohouse.com/san-pham/ecento-70');
  assert.equal(schema.image, 'https://nhomeurohouse.com/images/products/ecento-70.jpg');
  assert.equal(schema.brand.name, 'EUROHOUSE');
  assert.deepEqual(schema.additionalProperty, [{ '@type': 'PropertyValue', name: 'Mã hệ', value: 'EU-70' }]);
  assert.equal('offers' in schema, false);
  assert.equal('aggregateRating' in schema, false);
  assert.equal(JSON.stringify(schema).includes('Chưa duyệt'), false);
});

test('service and article schemas expose only supplied public facts', () => {
  const service = buildServiceSchema({
    name: 'Đùn thuê profile nhôm',
    description: 'Dịch vụ đùn theo hồ sơ kỹ thuật.',
    url: '/nhom-cong-nghiep/dun-thue',
    serviceType: 'Nhôm công nghiệp',
  });
  assert.equal(service.url, 'https://nhomeurohouse.com/nhom-cong-nghiep/dun-thue');
  assert.equal(service.provider['@id'], 'https://nhomeurohouse.com/#organization');
  assert.equal('offers' in service, false);

  const article = buildArticleSchema({
    headline: 'Cách chuẩn bị bản vẽ nhôm công nghiệp',
    description: 'Hướng dẫn chuẩn bị hồ sơ rõ ràng.',
    url: '/kien-thuc/cach-chuan-bi-ban-ve-nhom-cong-nghiep',
    image: '/images/v4/aluminum-billets.jpg',
  });
  assert.equal(article.mainEntityOfPage['@id'], 'https://nhomeurohouse.com/kien-thuc/cach-chuan-bi-ban-ve-nhom-cong-nghiep');
  assert.equal(article.publisher['@id'], 'https://nhomeurohouse.com/#organization');
  assert.equal(article.image, 'https://nhomeurohouse.com/images/v4/aluminum-billets.jpg');
});

test('FAQ schema mirrors the visible question and answer pairs', () => {
  const items = [
    { question: 'EUROHOUSE có những nhóm sản phẩm nào?', answer: 'Nhôm dân dụng và Nhôm công nghiệp.' },
    { question: 'Có thể gửi bản vẽ ở đâu?', answer: 'Gửi tại trang Nhôm công nghiệp.' },
  ] as const;
  const schema = buildFaqSchema(items);

  assert.deepEqual(
    schema.mainEntity.map((item) => ({ question: item.name, answer: item.acceptedAnswer.text })),
    items,
  );
});
