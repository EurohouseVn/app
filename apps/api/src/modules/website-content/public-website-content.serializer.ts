import type {
  PublicDocumentProjection,
  PublicMediaProjection,
  PublicWebsiteContentDetail,
  PublicWebsiteContentSummary,
  HomepageMediaRole,
  WebsiteContentKind,
  WebsiteProductFamily,
} from '@eurohouse/types';

type DateValue = Date | string;

type PublicSource = {
  id: string;
  slug: string;
  locale: string;
  kind: string;
  family?: string | null;
  updatedAt: DateValue;
  aluSystem?: { id: string; code: string; name: string } | null;
  revisions: PublicRevisionSource[];
};

type PublicRevisionSource = {
  id: string;
  revision: number;
  status: string;
  title: string;
  eyebrow?: string | null;
  summary: string;
  body: unknown;
  specifications?: unknown;
  updatedAt: DateValue;
  seo?: {
    title: string;
    description: string;
    canonicalPath: string;
    schemaType: string;
    reviewDate?: DateValue | null;
    reviewer?: { displayName?: string | null } | null;
  } | null;
  media?: Array<{
    role: string;
    sortOrder: number;
    mediaAsset: {
      id: string;
      mediaType: string;
      channels: string[];
      altText: string;
      caption?: string | null;
      transcript?: string | null;
      storageObject: { publicUrl?: string | null; metadata?: unknown };
      posterStorageObject?: { publicUrl?: string | null } | null;
    };
  }>;
  documents?: Array<{
    sortOrder: number;
    document: {
      id: string;
      title: string;
      documentType: string;
      revisionLabel: string;
      effectiveDate: DateValue;
      channels: string[];
      storageObject: { publicUrl?: string | null };
    };
  }>;
};

function iso(value: DateValue): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function metadataNumber(metadata: unknown, key: string): number | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function latestPublished(revisions: PublicRevisionSource[]): PublicRevisionSource | null {
  return revisions
    .filter((revision) => revision.status === 'PUBLISHED')
    .sort((left, right) => right.revision - left.revision)[0] ?? null;
}

function publicMedia(revision: PublicRevisionSource): Array<PublicMediaProjection & { role: HomepageMediaRole }> {
  return (revision.media ?? [])
    .filter((link) => link.mediaAsset.channels.includes('PUBLIC') && Boolean(link.mediaAsset.storageObject.publicUrl))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((link) => {
      const asset = link.mediaAsset;
      const metadata = asset.storageObject.metadata;
      const item: PublicMediaProjection & { role: HomepageMediaRole } = {
        id: asset.id,
        role: link.role as HomepageMediaRole,
        mediaType: asset.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE',
        url: asset.storageObject.publicUrl!,
        altText: asset.altText,
      };
      if (asset.caption) item.caption = asset.caption;
      if (asset.posterStorageObject?.publicUrl) item.posterUrl = asset.posterStorageObject.publicUrl;
      if (asset.transcript) item.transcript = asset.transcript;
      const width = metadataNumber(metadata, 'width');
      const height = metadataNumber(metadata, 'height');
      const durationSeconds = metadataNumber(metadata, 'durationSeconds');
      if (width !== undefined) item.width = width;
      if (height !== undefined) item.height = height;
      if (durationSeconds !== undefined) item.durationSeconds = durationSeconds;
      return item;
    });
}

function publicDocuments(revision: PublicRevisionSource): PublicDocumentProjection[] {
  return (revision.documents ?? [])
    .filter((link) => link.document.channels.includes('PUBLIC') && Boolean(link.document.storageObject.publicUrl))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((link) => {
      const document = link.document;
      return {
        id: document.id,
        title: document.title,
        documentType: document.documentType,
        revisionLabel: document.revisionLabel,
        effectiveDate: iso(document.effectiveDate),
        downloadUrl: document.storageObject.publicUrl!,
      };
    });
}

function summary(source: PublicSource, revision: PublicRevisionSource): PublicWebsiteContentSummary {
  const item: PublicWebsiteContentSummary = {
    id: source.id,
    slug: source.slug,
    locale: source.locale,
    kind: source.kind as WebsiteContentKind,
    title: revision.title,
    summary: revision.summary,
    updatedAt: iso(revision.updatedAt),
  };
  if (source.family) item.family = source.family as WebsiteProductFamily;
  if (revision.eyebrow) item.eyebrow = revision.eyebrow;
  if (source.aluSystem) {
    item.linkedSystem = {
      id: source.aluSystem.id,
      code: source.aluSystem.code,
      name: source.aluSystem.name,
    };
  }
  return item;
}

export function serializePublishedWebsiteSummary(source: PublicSource): PublicWebsiteContentSummary | null {
  const revision = latestPublished(source.revisions);
  return revision ? summary(source, revision) : null;
}

export function serializeWebsiteRevisionPreview(
  source: PublicSource,
  revisionId: string,
): PublicWebsiteContentDetail | null {
  const revision = source.revisions.find((item) => item.id === revisionId);
  return revision ? serializeDetail(source, revision) : null;
}

export function serializePublishedWebsiteContent(source: PublicSource): PublicWebsiteContentDetail | null {
  const revision = latestPublished(source.revisions);
  return revision ? serializeDetail(source, revision) : null;
}

function serializeDetail(source: PublicSource, revision: PublicRevisionSource): PublicWebsiteContentDetail {
  const base = summary(source, revision);
  const detail: PublicWebsiteContentDetail = {
    id: base.id,
    slug: base.slug,
    locale: base.locale,
    kind: base.kind,
    title: base.title,
    summary: base.summary,
    updatedAt: base.updatedAt,
    body: revision.body,
    seo: revision.seo
      ? {
        title: revision.seo.title,
        description: revision.seo.description,
        canonicalPath: revision.seo.canonicalPath,
        schemaType: revision.seo.schemaType,
      }
      : {
        title: revision.title,
        description: revision.summary,
        canonicalPath: `/${source.slug}`,
        schemaType: 'WebPage',
      },
    media: publicMedia(revision),
    documents: publicDocuments(revision),
  };

  // Add optional allowlisted fields in the stable public contract order.
  const ordered: PublicWebsiteContentDetail = {
    id: detail.id,
    slug: detail.slug,
    locale: detail.locale,
    kind: detail.kind,
    ...(base.family ? { family: base.family } : {}),
    title: detail.title,
    ...(base.eyebrow ? { eyebrow: base.eyebrow } : {}),
    summary: detail.summary,
    updatedAt: detail.updatedAt,
    ...(base.linkedSystem ? { linkedSystem: base.linkedSystem } : {}),
    body: detail.body,
    ...(revision.specifications !== null && revision.specifications !== undefined
      ? { specifications: revision.specifications }
      : {}),
    seo: detail.seo,
    media: detail.media,
    documents: detail.documents,
  };
  if (revision.seo?.reviewDate) ordered.seo.reviewDate = iso(revision.seo.reviewDate);
  if (revision.seo?.reviewer?.displayName) ordered.seo.reviewer = revision.seo.reviewer.displayName;
  return ordered;
}
