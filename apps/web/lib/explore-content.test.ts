import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterProjects,
  groupDocumentsByType,
  normalizeProjectQuery,
  publishedSections,
  publishedSpecifications,
  publicContentHref,
  safeTechnicalValue,
  searchSiteIndex,
  serializeProjectQuery,
  type ProjectSummary,
  type SiteSearchEntry,
} from './explore-content';
import { createSearchAnalyticsSignal } from './public-analytics';

const projects: ProjectSummary[] = [
  { slug: 'biet-thu-an-nhien', title: 'Biệt thự An Nhiên', summary: 'Giải pháp cửa cho nhà ở.', type: 'Biệt thự', region: 'Hưng Yên', system: 'ECENTO 70', year: '2026' },
  { slug: 'showroom-ky-thuat', title: 'Showroom kỹ thuật', summary: 'Không gian trưng bày profile.', type: 'Thương mại', region: 'Hà Nội', system: 'ECENTO PLUS', year: '2025' },
];

test('project query rejects unknown facets and serializes a stable shareable URL', () => {
  const query = normalizeProjectQuery(new URLSearchParams('q=biet+thu&type=Bi%E1%BB%87t+th%E1%BB%B1&type=Kh%C3%B4ng+h%E1%BB%A3p+l%E1%BB%87&year=2026'));
  assert.deepEqual(query, { q: 'biet thu', types: ['Biệt thự'], regions: [], systems: [], years: ['2026'] });
  assert.equal(serializeProjectQuery(query), 'q=biet+thu&type=Bi%E1%BB%87t+th%E1%BB%B1&year=2026');
});

test('published content kinds resolve to canonical public detail routes', () => {
  assert.equal(publicContentHref('CASE_STUDY', 'du-an-a'), '/du-an/du-an-a');
  assert.equal(publicContentHref('VIDEO', 'nha-may'), '/tai-nguyen/video/nha-may');
  assert.equal(publicContentHref('ARTICLE', 'chon-he'), '/kien-thuc/chon-he');
  assert.equal(publicContentHref('PRODUCT', 'ecento-70', 'RESIDENTIAL'), '/nhom-dan-dung/dong-san-pham/ecento-70');
  assert.equal(publicContentHref('INDUSTRIAL_SERVICE', 'dun-thue', 'INDUSTRIAL'), '/nhom-cong-nghiep/dun-thue');
});

test('published rich content accepts only explicit text sections and specification pairs', () => {
  assert.deepEqual(publishedSections({ sections: [{ title: 'Bối cảnh', paragraphs: ['Nội dung đã duyệt.', 42] }, { title: '', paragraphs: ['Bỏ qua'] }] }), [
    { title: 'Bối cảnh', paragraphs: ['Nội dung đã duyệt.'] },
  ]);
  assert.deepEqual(publishedSpecifications({ 'Hệ sử dụng': 'ECENTO 70', 'Giá nội bộ': 123 }), [
    ['Hệ sử dụng', 'ECENTO 70'],
  ]);
  assert.deepEqual(publishedSections('html tùy ý'), []);
});

test('project search matches Vietnamese text without diacritics and combines facets', () => {
  const query = normalizeProjectQuery(new URLSearchParams('q=biet+thu&region=H%C6%B0ng+Y%C3%AAn&year=2026'));
  assert.deepEqual(filterProjects(projects, query).map((item) => item.slug), ['biet-thu-an-nhien']);
});

test('technical values stay neutral until their source is verified', () => {
  assert.equal(safeTechnicalValue('2.500 T', false), 'Liên hệ xác nhận kỹ thuật');
  assert.equal(safeTechnicalValue('Hồ sơ đã duyệt', true), 'Hồ sơ đã duyệt');
  assert.equal(safeTechnicalValue('', true), 'Liên hệ xác nhận kỹ thuật');
});

test('documents are grouped by governed type while preserving revision metadata', () => {
  const groups = groupDocumentsByType([
    { id: '2', title: 'Catalog B', documentType: 'CATALOG', revisionLabel: 'R2', effectiveDate: '2026-10-01', downloadUrl: '/b.pdf' },
    { id: '1', title: 'Hướng dẫn A', documentType: 'TECHNICAL', revisionLabel: 'R1', effectiveDate: '2026-09-01', downloadUrl: '/a.pdf' },
  ]);
  assert.deepEqual(groups.map((group) => [group.type, group.documents.length]), [['CATALOG', 1], ['TECHNICAL', 1]]);
  assert.equal(groups[0]?.documents[0]?.revisionLabel, 'R2');
});

test('site search returns stable routes and zero-result analytics only for a real query', () => {
  const index: SiteSearchEntry[] = [
    { title: 'Nhôm năng lượng mặt trời', summary: 'Profile cho hệ giá đỡ.', href: '/nhom-cong-nghiep/nang-luong-mat-troi', kind: 'Dịch vụ' },
    { title: 'Chuẩn bị bản vẽ kỹ thuật', summary: 'Các dữ liệu cần có.', href: '/kien-thuc/chuan-bi-ban-ve', kind: 'Kiến thức' },
  ];
  assert.equal(searchSiteIndex(index, 'nang luong')[0]?.href, '/nhom-cong-nghiep/nang-luong-mat-troi');
  assert.equal(createSearchAnalyticsSignal('khong co', 0)?.name, 'public_search_zero_result');
  assert.equal(createSearchAnalyticsSignal('', 0), null);
  assert.equal(createSearchAnalyticsSignal('nhom', 2)?.name, 'public_search');
});
