import type {
  AdminWebsiteReview,
  PublicSeoProjection,
  PublicWebsiteContentDetail,
  PublicWebsiteContentSummary,
  WebsiteChannel,
  WebsiteMediaIntakeStatus,
  WebsitePublicationStatus,
} from './index.js';

export const HOMEPAGE_SCHEMA_VERSION = 1 as const;

export const HOMEPAGE_BODY_SECTION_KEYS = [
  'hero',
  'productFields',
  'residential',
  'industrial',
  'evidence',
  'projects',
  'video',
  'contact',
] as const;
export type HomepageBodySectionKey = (typeof HOMEPAGE_BODY_SECTION_KEYS)[number];

export const HOMEPAGE_EDITOR_SECTION_KEYS = [...HOMEPAGE_BODY_SECTION_KEYS, 'seo'] as const;
export type HomepageEditorSectionKey = (typeof HOMEPAGE_EDITOR_SECTION_KEYS)[number];

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
] as const;
export type HomepageMediaRole = (typeof HOMEPAGE_MEDIA_ROLES)[number];

export const WEBSITE_FAMILY_ROUTES = {
  RESIDENTIAL: '/nhom-dan-dung',
  INDUSTRIAL: '/nhom-cong-nghiep',
} as const;

export const WEBSITE_PERMISSIONS = {
  module: 'website',
  reviewTechnical: 'website-review-technical',
  reviewMarketing: 'website-review-marketing',
  approveMedia: 'website-media-approve',
  publish: 'website-publish',
} as const;

export type HomepageCta = {
  label: string;
  href: string;
};

export type HomepageSectionCopy = {
  eyebrow: string;
  title: string;
  summary: string;
};

export type HomepageHeroSection = HomepageSectionCopy & {
  primaryCta: HomepageCta;
  secondaryCta: HomepageCta;
};

export type HomepageProductField = {
  title: string;
  summary: string;
  cta: HomepageCta;
};

export type HomepageProductFieldsSection = HomepageSectionCopy & {
  residential: HomepageProductField & { route: typeof WEBSITE_FAMILY_ROUTES.RESIDENTIAL };
  industrial: HomepageProductField & { route: typeof WEBSITE_FAMILY_ROUTES.INDUSTRIAL };
};

export type HomepageContentReference = {
  contentId: string;
};

export type HomepageResidentialSection = HomepageSectionCopy & {
  dominant: HomepageContentReference;
  supporting: HomepageContentReference[];
  cta: HomepageCta;
};

export type HomepageIndustrialSection = HomepageSectionCopy & {
  services: HomepageContentReference[];
  primaryCta: HomepageCta;
  secondaryCta: HomepageCta;
};

export type HomepageEvidenceItem = {
  title: string;
  summary: string;
};

export type HomepageEvidenceSection = HomepageSectionCopy & {
  items: HomepageEvidenceItem[];
};

export type HomepageProjectsSection = HomepageSectionCopy & {
  featured: HomepageContentReference[];
  cta: HomepageCta;
};

export type HomepageVideoSection = HomepageSectionCopy;

export type HomepageContactSection = HomepageSectionCopy & {
  architecturalCta: HomepageCta;
  industrialCta: HomepageCta;
};

export type HomepagePayloadV1 = {
  schemaVersion: typeof HOMEPAGE_SCHEMA_VERSION;
  hero: HomepageHeroSection;
  productFields: HomepageProductFieldsSection;
  residential: HomepageResidentialSection;
  industrial: HomepageIndustrialSection;
  evidence: HomepageEvidenceSection;
  projects: HomepageProjectsSection;
  video: HomepageVideoSection;
  contact: HomepageContactSection;
};

export type HomepageSeoInput = {
  title: string;
  description: string;
  canonicalPath: string;
  schemaType: string;
  reviewDate?: string;
  socialShareMediaId?: string;
};

export type HomepageSaveInput = {
  payload: HomepagePayloadV1;
  expectedUpdatedAt: string;
  seo: HomepageSeoInput;
  mediaByRole: Partial<Record<HomepageMediaRole, string>>;
};

export type HomepageReadinessIssue = {
  path: string;
  code: string;
  message: string;
};

export type HomepagePublishReadiness = {
  ready: boolean;
  reviewClass: 'TECHNICAL_AND_MARKETING' | 'MARKETING_ONLY';
  blockers: HomepageReadinessIssue[];
  warnings: HomepageReadinessIssue[];
};

export type HomepageRevisionHistoryItem = {
  id: string;
  revision: number;
  status: WebsitePublicationStatus;
  updatedAt: string;
  publishedAt?: string;
  editorId?: string;
  editorName?: string;
  reviews: AdminWebsiteReview[];
};

export type HomepageAdminDetail = {
  contentId: string;
  slug: 'trang-chu';
  locale: 'vi';
  revisionId: string;
  revision: number;
  status: WebsitePublicationStatus;
  updatedAt: string;
  payload: HomepagePayloadV1;
  seo: HomepageSeoInput;
  mediaByRole: Partial<Record<HomepageMediaRole, WebsiteMediaLibraryItem>>;
  repairWarnings: HomepageReadinessIssue[];
  history: HomepageRevisionHistoryItem[];
};

export type HomepagePublicMedia = PublicWebsiteContentDetail['media'][number] & {
  role: HomepageMediaRole;
};

export interface HomepagePublicProjection extends Omit<PublicWebsiteContentDetail, 'media'> {
  media: HomepagePublicMedia[];
  resolvedReferences: PublicWebsiteContentSummary[];
}

export type WebsiteRightsStatus = 'UNKNOWN' | 'PENDING' | 'APPROVED' | 'REJECTED';

export type WebsiteMediaUsage = {
  contentId: string;
  contentTitle: string;
  revisionId: string;
  revision: number;
  status: WebsitePublicationStatus;
  role: string;
};

export type WebsiteMediaLibraryItem = {
  id: string;
  mediaType: 'IMAGE' | 'VIDEO';
  originalFilename: string;
  previewUrl?: string;
  publicUrl?: string;
  altText: string;
  caption?: string;
  transcript?: string;
  posterUrl?: string;
  focalPointX?: number;
  focalPointY?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  sizeBytes: number;
  rightsStatus: WebsiteRightsStatus;
  intakeStatus: WebsiteMediaIntakeStatus;
  channels: WebsiteChannel[];
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
  usages: WebsiteMediaUsage[];
};
