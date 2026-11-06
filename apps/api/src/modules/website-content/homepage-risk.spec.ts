import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import test from 'node:test';
import type { HomepagePayloadV1 } from '@eurohouse/types';
import {
  classifyHomepageChange,
  computeHomepageTechnicalRiskHash,
  type HomepageTechnicalRiskInput,
} from './homepage-risk';

function payload(): HomepagePayloadV1 {
  const copy = (title: string) => ({ eyebrow: 'EUROHOUSE', title, summary: `Giới thiệu ${title}` });
  const cta = (label: string, href: string) => ({ label, href });
  return {
    schemaVersion: 1,
    hero: { ...copy('Định hình không gian'), primaryCta: cta('Dân dụng', '/nhom-dan-dung'), secondaryCta: cta('Công nghiệp', '/nhom-cong-nghiep') },
    productFields: {
      ...copy('Hai lĩnh vực'),
      residential: { title: 'NHÔM DÂN DỤNG', summary: 'Kiến trúc', route: '/nhom-dan-dung', cta: cta('Khám phá', '/nhom-dan-dung') },
      industrial: { title: 'NHÔM CÔNG NGHIỆP', summary: 'Sản xuất', route: '/nhom-cong-nghiep', cta: cta('Khám phá', '/nhom-cong-nghiep') },
    },
    residential: { ...copy('Hệ nhôm dân dụng'), dominant: { contentId: 'res-1' }, supporting: [{ contentId: 'res-2' }], cta: cta('Xem hệ nhôm', '/nhom-dan-dung') },
    industrial: { ...copy('Đùn profile theo bản vẽ'), services: [{ contentId: 'service-1' }], primaryCta: cta('Gửi bản vẽ', '/lien-he'), secondaryCta: cta('Năng lực', '/nang-luc') },
    evidence: { ...copy('Năng lực sản xuất'), items: [{ title: 'Đùn ép', summary: 'Profile theo ứng dụng.' }, { title: 'Gia công', summary: 'Cắt và khoan.' }] },
    projects: { ...copy('Công trình'), featured: [{ contentId: 'project-1' }], cta: cta('Xem dự án', '/du-an') },
    video: copy('Hành trình EUROHOUSE'),
    contact: { ...copy('Bắt đầu cùng EUROHOUSE'), architecturalCta: cta('Tư vấn', '/lien-he'), industrialCta: cta('Gửi bản vẽ', '/lien-he') },
  };
}

function input(): HomepageTechnicalRiskInput {
  return {
    payload: payload(),
    specifications: { alloy: '6063-T5', tolerance: 'Theo bản vẽ duyệt' },
    sourceRefs: [{ title: 'Catalog R19', page: 4 }],
    references: [
      { contentId: 'res-1', publishedRevisionId: 'rev-res-1' },
      { contentId: 'service-1', publishedRevisionId: 'rev-service-1' },
      { contentId: 'project-1', publishedRevisionId: 'rev-project-1' },
    ],
    media: [
      { role: 'HERO_BACKGROUND', mediaAssetId: 'hero-1', caption: 'Nhà máy EUROHOUSE' },
      { role: 'INDUSTRIAL_BACKGROUND', mediaAssetId: 'factory-1', caption: 'Dây chuyền đùn ép' },
      { role: 'VIDEO_PRIMARY', mediaAssetId: 'video-1', transcript: 'Quy trình gia công profile.' },
    ],
  };
}

function changed(mutator: (value: HomepageTechnicalRiskInput) => void) {
  const before = input();
  const after = structuredClone(before);
  mutator(after);
  return { before, after };
}

test('technical material produces a deterministic 64-character risk hash', () => {
  const first = input();
  const reordered = structuredClone(first);
  reordered.specifications = { tolerance: 'Theo bản vẽ duyệt', alloy: '6063-T5' };
  reordered.sourceRefs = [{ page: 4, title: 'Catalog R19' }];
  assert.match(computeHomepageTechnicalRiskHash(first), /^[a-f0-9]{64}$/);
  assert.equal(computeHomepageTechnicalRiskHash(first), computeHomepageTechnicalRiskHash(reordered));
});

test('technical fields, references and governed capability media change the hash', () => {
  const cases: Array<(value: HomepageTechnicalRiskInput) => void> = [
    (value) => { value.specifications = { alloy: '6061-T6' }; },
    (value) => { value.sourceRefs = [{ title: 'Tiêu chuẩn mới' }]; },
    (value) => { value.references[0]!.contentId = 'res-3'; },
    (value) => { value.references[0]!.publishedRevisionId = 'rev-res-2'; },
    (value) => { value.payload.industrial.summary = 'Đùn ép và xử lý bề mặt'; },
    (value) => { value.payload.evidence.items[0]!.summary = 'Dung sai được kiểm soát'; },
    (value) => { value.media[1]!.mediaAssetId = 'factory-2'; },
    (value) => { value.media[2]!.transcript = 'Quy trình đùn ép và CNC.'; },
  ];
  for (const mutate of cases) {
    const { before, after } = changed(mutate);
    assert.notEqual(computeHomepageTechnicalRiskHash(before), computeHomepageTechnicalRiskHash(after));
    assert.equal(classifyHomepageChange(before, after), 'TECHNICAL_AND_MARKETING');
  }
});

test('punctuation and formatting do not invalidate technical approval', () => {
  const { before, after } = changed((value) => {
    value.payload.industrial.summary = '  Đùn profile theo bản vẽ!!! ';
    value.sourceRefs = [{ page: 4, title: 'Catalog   R19.' }];
  });
  before.payload.industrial.summary = 'Đùn profile theo bản vẽ.';
  assert.equal(computeHomepageTechnicalRiskHash(before), computeHomepageTechnicalRiskHash(after));
  assert.equal(classifyHomepageChange(before, after), 'MARKETING_ONLY');
});

test('ordinary homepage presentation changes remain marketing-only', () => {
  const cases: Array<(value: HomepageTechnicalRiskInput) => void> = [
    (value) => { value.payload.hero.title = 'Một tiêu đề thương hiệu mới'; },
    (value) => { value.payload.productFields.residential.summary = 'Không gian sống hiện đại'; },
    (value) => { value.payload.residential.title = 'Hệ nhôm cho biệt thự'; },
    (value) => { value.payload.projects.title = 'Dự án tiêu biểu'; },
    (value) => { value.payload.contact.architecturalCta.label = 'Nhận tư vấn'; },
    (value) => { value.media[0]!.mediaAssetId = 'hero-2'; },
    (value) => { value.seo = { title: 'Nhôm Eurohouse', description: 'Nhôm cao cấp', canonicalPath: '/', schemaType: 'WebPage' }; },
  ];
  for (const mutate of cases) {
    const { before, after } = changed(mutate);
    assert.equal(classifyHomepageChange(before, after), 'MARKETING_ONLY');
  }
});

test('governance migration is additive and schema exposes risk provenance', () => {
  const schema = readFileSync(path.resolve(__dirname, '../../../prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(path.resolve(__dirname, '../../../prisma/migrations/20261106100000_website_homepage_governance/migration.sql'), 'utf8');
  assert.match(schema, /technicalRiskHash\s+String\?/);
  assert.match(schema, /technicalApprovalSourceRevisionId\s+String\?/);
  assert.match(schema, /archivedAt\s+DateTime\?/);
  assert.match(migration, /ADD COLUMN "technicalRiskHash" VARCHAR\(64\)/);
  assert.doesNotMatch(migration, /DROP\s|TRUNCATE|DELETE\s+FROM/i);
});
