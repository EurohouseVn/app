import assert from 'node:assert/strict';
import test from 'node:test';
import {
  HomepagePayloadValidationError,
  assertHomepageUrl,
  parseHomepagePayload,
} from './homepage-payload';

function validPayload(): Record<string, any> {
  const copy = (title: string) => ({ eyebrow: 'EUROHOUSE', title, summary: `Giới thiệu ${title}` });
  const cta = (label: string, href: string) => ({ label, href });
  return {
    schemaVersion: 1,
    hero: {
      ...copy('Định hình không gian. Kiến tạo sản xuất.'),
      primaryCta: cta('Khám phá hệ nhôm', '/nhom-dan-dung'),
      secondaryCta: cta('Xem năng lực', 'https://nhomeurohouse.com/nang-luc'),
    },
    productFields: {
      ...copy('Hai lĩnh vực. Một chuẩn mực.'),
      residential: {
        title: 'NHÔM DÂN DỤNG',
        summary: 'Hệ nhôm kiến trúc cho nhà ở và dự án.',
        route: '/nhom-dan-dung',
        cta: cta('Xem nhôm dân dụng', '/nhom-dan-dung'),
      },
      industrial: {
        title: 'NHÔM CÔNG NGHIỆP',
        summary: 'Profile kỹ thuật và gia công theo yêu cầu.',
        route: '/nhom-cong-nghiep',
        cta: cta('Xem nhôm công nghiệp', '/nhom-cong-nghiep'),
      },
    },
    residential: {
      ...copy('Hệ nhôm cho từng không gian'),
      dominant: { contentId: 'residential-main' },
      supporting: [{ contentId: 'residential-two' }],
      cta: cta('Xem tất cả hệ nhôm', '/nhom-dan-dung'),
    },
    industrial: {
      ...copy('Từ bản vẽ đến sản phẩm'),
      services: [{ contentId: 'service-one' }, { contentId: 'service-two' }],
      primaryCta: cta('Gửi bản vẽ', '/lien-he'),
      secondaryCta: cta('Xem năng lực', '/nang-luc'),
    },
    evidence: {
      ...copy('Năng lực được chứng minh'),
      items: [
        { title: 'Đùn profile', summary: 'Phát triển profile theo ứng dụng.' },
        { title: 'Gia công sau đùn', summary: 'Cắt, khoan và hoàn thiện chi tiết.' },
      ],
    },
    projects: {
      ...copy('Công trình và ứng dụng'),
      featured: [{ contentId: 'project-one' }],
      cta: cta('Xem thư viện dự án', '/du-an'),
    },
    video: copy('Hành trình từ phôi nhôm đến công trình'),
    contact: {
      ...copy('Bắt đầu cùng EUROHOUSE'),
      architecturalCta: cta('Tư vấn hệ nhôm', '/lien-he'),
      industrialCta: cta('Gửi bản vẽ', '/yeu-cau-bao-gia-cong-nghiep'),
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function expectInvalid(value: unknown, code: string, path: string) {
  assert.throws(
    () => parseHomepagePayload(value),
    (error: unknown) => {
      assert.ok(error instanceof HomepagePayloadValidationError);
      assert.ok(error.issues.some((issue) => issue.code === code && issue.path === path), JSON.stringify(error.issues));
      return true;
    },
  );
}

test('parses and trims one complete HomepagePayloadV1', () => {
  const payload = validPayload();
  payload.hero.title = `  ${payload.hero.title}  `;
  const parsed = parseHomepagePayload(payload);
  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.hero.title, 'Định hình không gian. Kiến tạo sản xuất.');
  assert.equal('seo' in parsed, false);
});

test('rejects unknown keys, unsupported versions and missing required branches', () => {
  const unknown = validPayload();
  unknown.layout = 'free-form';
  expectInvalid(unknown, 'UNKNOWN_KEY', 'layout');

  const unsupported = validPayload();
  unsupported.schemaVersion = 2;
  expectInvalid(unsupported, 'UNSUPPORTED_VERSION', 'schemaVersion');

  const missing = validPayload();
  delete missing.contact.industrialCta;
  expectInvalid(missing, 'REQUIRED', 'contact.industrialCta');
});

test('enforces copy and CTA length limits without truncating', () => {
  const cases: Array<[string, (value: any) => void, string]> = [
    ['hero.eyebrow', (value) => { value.hero.eyebrow = 'x'.repeat(81); }, 'MAX_LENGTH'],
    ['hero.title', (value) => { value.hero.title = 'x'.repeat(121); }, 'MAX_LENGTH'],
    ['hero.summary', (value) => { value.hero.summary = 'x'.repeat(361); }, 'MAX_LENGTH'],
    ['hero.primaryCta.label', (value) => { value.hero.primaryCta.label = 'x'.repeat(41); }, 'MAX_LENGTH'],
    ['hero.primaryCta.href', (value) => { value.hero.primaryCta.href = `/${'x'.repeat(300)}`; }, 'MAX_LENGTH'],
    ['evidence.items.0.title', (value) => { value.evidence.items[0].title = 'x'.repeat(81); }, 'MAX_LENGTH'],
    ['evidence.items.0.summary', (value) => { value.evidence.items[0].summary = 'x'.repeat(241); }, 'MAX_LENGTH'],
  ];
  for (const [path, mutate, code] of cases) {
    const value = validPayload();
    mutate(value);
    expectInvalid(value, code, path);
  }
});

test('accepts only relative same-site paths and https URLs', () => {
  assert.equal(assertHomepageUrl('/nhom-dan-dung', 'cta.href'), '/nhom-dan-dung');
  assert.equal(assertHomepageUrl('https://nhomeurohouse.com/lien-he', 'cta.href'), 'https://nhomeurohouse.com/lien-he');
  for (const href of ['javascript:alert(1)', 'http://example.com', '//example.com', 'lien-he']) {
    assert.throws(() => assertHomepageUrl(href, 'cta.href'), HomepagePayloadValidationError);
  }
});

test('enforces reference and repeated-item cardinalities', () => {
  const cases: Array<[string, (value: any) => void]> = [
    ['residential.supporting', (value) => { value.residential.supporting = [{ contentId: 'a' }, { contentId: 'b' }, { contentId: 'c' }]; }],
    ['industrial.services', (value) => { value.industrial.services = []; }],
    ['industrial.services', (value) => { value.industrial.services = ['a', 'b', 'c', 'd', 'e'].map((contentId) => ({ contentId })); }],
    ['evidence.items', (value) => { value.evidence.items = [value.evidence.items[0]]; }],
    ['evidence.items', (value) => { value.evidence.items.push({}, {}, {}); }],
    ['projects.featured', (value) => { value.projects.featured = []; }],
    ['projects.featured', (value) => { value.projects.featured = ['a', 'b', 'c', 'd'].map((contentId) => ({ contentId })); }],
  ];
  for (const [path, mutate] of cases) {
    const value = validPayload();
    mutate(value);
    expectInvalid(value, 'CARDINALITY', path);
  }
});

test('rejects duplicate references across an approved collection', () => {
  const residential = validPayload();
  residential.residential.supporting = [{ contentId: residential.residential.dominant.contentId }];
  expectInvalid(residential, 'DUPLICATE_REFERENCE', 'residential.supporting.0.contentId');

  const industrial = validPayload();
  industrial.industrial.services.push(clone(industrial.industrial.services[0]));
  expectInvalid(industrial, 'DUPLICATE_REFERENCE', 'industrial.services.2.contentId');
});

test('rejects markup in customer copy and unsupported external video fields', () => {
  const markupCases: Array<[string, (value: any) => void]> = [
    ['hero.title', (value) => { value.hero.title = '<strong>Nhôm cao cấp</strong>'; }],
    ['hero.primaryCta.label', (value) => { value.hero.primaryCta.label = '<script>alert(1)</script>'; }],
    ['hero.primaryCta.href', (value) => { value.hero.primaryCta.href = '/lien-he?<script>'; }],
  ];
  for (const [path, mutate] of markupCases) {
    const value = validPayload();
    mutate(value);
    expectInvalid(value, 'MARKUP_NOT_ALLOWED', path);
  }

  const externalVideo = validPayload();
  externalVideo.video.embedUrl = 'https://youtube.com/watch?v=demo';
  expectInvalid(externalVideo, 'UNKNOWN_KEY', 'video.embedUrl');
});

test('requires the two fixed product-family routes', () => {
  const value = validPayload();
  value.productFields.industrial.route = '/cong-nghiep-khac';
  expectInvalid(value, 'FIXED_VALUE', 'productFields.industrial.route');
});
