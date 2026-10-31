import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicWebsiteContentDetail } from '@eurohouse/types';

import { composeHomepageContent, type HomepageCandidate } from './homepage-content';

test('homepage composition accepts only published content and strips price-like fields', () => {
  const publishedResidential = candidate(detail({ slug: 'ecento-70', kind: 'PRODUCT', family: 'RESIDENTIAL' }), 'PUBLISHED');
  Object.assign(publishedResidential.content, { price: 123_000, dealerPrice: 99_000 });
  const draftIndustrial = candidate(detail({ slug: 'dun-thue', kind: 'INDUSTRIAL_SERVICE', family: 'INDUSTRIAL' }), 'DRAFT');

  const result = composeHomepageContent([publishedResidential, draftIndustrial]);

  assert.deepEqual(result.residential.map((item) => item.slug), ['ecento-70']);
  assert.deepEqual(result.industrial, []);
  assert.equal(JSON.stringify(result).includes('price'), false);
  assert.equal(JSON.stringify(result).includes('123000'), false);
});

test('homepage selects one published primary video only with a poster and crawlable text', () => {
  const validVideo = candidate(detail({
    slug: 'nang-luc-eurohouse',
    kind: 'VIDEO',
    media: [{
      id: 'video-valid',
      mediaType: 'VIDEO',
      url: '/media/factory.mp4',
      posterUrl: '/media/factory.webp',
      altText: 'Dây chuyền sản xuất EUROHOUSE',
      caption: 'Năng lực sản xuất EUROHOUSE',
      transcript: 'Video giới thiệu quy trình sản xuất và kiểm soát chất lượng.',
    }],
  }), 'PUBLISHED');
  const missingPoster = candidate(detail({
    slug: 'video-thieu-poster',
    kind: 'VIDEO',
    media: [{ id: 'video-no-poster', mediaType: 'VIDEO', url: '/media/no-poster.mp4', altText: 'Video' }],
  }), 'PUBLISHED');
  const draftVideo = candidate(detail({
    slug: 'video-nhap',
    kind: 'VIDEO',
    media: [{ id: 'video-draft', mediaType: 'VIDEO', url: '/media/draft.mp4', posterUrl: '/media/draft.webp', altText: 'Video', transcript: 'Bản nháp.' }],
  }), 'DRAFT');

  const result = composeHomepageContent([missingPoster, draftVideo, validVideo]);

  assert.equal(result.primaryVideo?.slug, 'nang-luc-eurohouse');
  assert.equal(result.primaryVideo?.posterUrl, '/media/factory.webp');
  assert.equal(result.primaryVideo?.transcript, 'Video giới thiệu quy trình sản xuất và kiểm soát chất lượng.');
});

function candidate(content: PublicWebsiteContentDetail, publicationStatus: HomepageCandidate['publicationStatus']): HomepageCandidate {
  return { content, publicationStatus };
}

function detail(overrides: Partial<PublicWebsiteContentDetail> & Pick<PublicWebsiteContentDetail, 'slug' | 'kind'>): PublicWebsiteContentDetail {
  return {
    id: `content-${overrides.slug}`,
    slug: overrides.slug,
    locale: 'vi',
    kind: overrides.kind,
    family: overrides.family,
    title: overrides.title ?? overrides.slug,
    summary: overrides.summary ?? `Tóm tắt ${overrides.slug}`,
    updatedAt: '2026-10-30T00:00:00.000Z',
    body: {},
    seo: { title: overrides.slug, description: `Mô tả ${overrides.slug}`, canonicalPath: `/${overrides.slug}`, schemaType: 'WebPage' },
    media: overrides.media ?? [],
    documents: [],
  };
}
