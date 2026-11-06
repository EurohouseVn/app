export const HOMEPAGE_SCHEMA_VERSION = 1;

export const HOMEPAGE_BODY_SECTION_KEYS = [
  'hero',
  'productFields',
  'residential',
  'industrial',
  'evidence',
  'projects',
  'video',
  'contact',
];

export const HOMEPAGE_EDITOR_SECTION_KEYS = [...HOMEPAGE_BODY_SECTION_KEYS, 'seo'];

export const HOMEPAGE_MEDIA_ROLES = [
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
];

export const WEBSITE_FAMILY_ROUTES = {
  RESIDENTIAL: '/nhom-dan-dung',
  INDUSTRIAL: '/nhom-cong-nghiep',
};

export const WEBSITE_PERMISSIONS = {
  module: 'website',
  reviewTechnical: 'website-review-technical',
  reviewMarketing: 'website-review-marketing',
  approveMedia: 'website-media-approve',
  publish: 'website-publish',
};
