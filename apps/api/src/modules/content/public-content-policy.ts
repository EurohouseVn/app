export type PublicContentRecord = Record<string, unknown>;
export type PublicContentView = Record<string, unknown>;

const PUBLIC_STATUSES = new Set(['ACTIVE', 'PUBLIC', 'PUBLISHED']);
const SAFE_FIELDS = [
  'id', 'slug', 'title', 'subtitle', 'description', 'content',
  'imageUrl', 'bannerUrl', 'gallery', 'mediaUrl', 'mediaType', 'categoryId',
  'targetAudience', 'active', 'startDate', 'endDate', 'publishedAt',
  'createdAt', 'updatedAt',
] as const;
const MEDIA_FIELDS = new Set(['imageUrl', 'bannerUrl', 'mediaUrl']);

function dateValue(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const url = value.trim();
  if (!url || url.length > 2048) return undefined;
  if (/^(https?:\/\/|\/)/i.test(url)) return url;
  return undefined;
}

function safeGallery(value: unknown): string[] {
  let items: unknown[] = [];
  if (Array.isArray(value)) items = value;
  else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      items = [];
    }
  }
  return items
    .map(safeMediaUrl)
    .filter((item): item is string => Boolean(item))
    .slice(0, 20);
}

export function isPublicPublished(record: PublicContentRecord, now = new Date()): boolean {
  const status = typeof record.status === 'string' ? record.status.toUpperCase() : undefined;
  if (status && !PUBLIC_STATUSES.has(status)) return false;
  if (record.active === false || record.isShared === false) return false;
  if (record.restricted === true || record.isRestricted === true) return false;

  const accessLevel = typeof record.accessLevel === 'string' ? record.accessLevel.toUpperCase() : undefined;
  if (accessLevel && accessLevel !== 'PUBLIC' && accessLevel !== 'ALL') return false;
  const visibility = typeof record.visibility === 'string' ? record.visibility.toUpperCase() : undefined;
  if (visibility && visibility !== 'PUBLIC' && visibility !== 'ALL') return false;

  const startsAt = dateValue(record.startDate ?? record.publishedAt);
  const endsAt = dateValue(record.endDate ?? record.expiresAt);
  if (Number.isNaN(startsAt) || Number.isNaN(endsAt)) return false;
  if (startsAt !== undefined && startsAt > now.getTime()) return false;
  if (endsAt !== undefined && endsAt <= now.getTime()) return false;
  return true;
}

export function sanitizePublicContent(record: PublicContentRecord): PublicContentView {
  const view: PublicContentView = {};
  for (const field of SAFE_FIELDS) {
    const value = record[field];
    if (value === undefined || value === null) continue;
    if (field === 'gallery') {
      const gallery = safeGallery(value);
      if (gallery.length) view.gallery = gallery;
      continue;
    }
    if (MEDIA_FIELDS.has(field)) {
      const mediaUrl = safeMediaUrl(value);
      if (mediaUrl) view[field] = mediaUrl;
      continue;
    }
    if (typeof value === 'string') {
      const text = value.trim();
      if (text) view[field] = text;
      continue;
    }
    view[field] = value;
  }

  const aluSystem = record.aluSystem as PublicContentRecord | undefined;
  if (aluSystem) {
    view.aluSystem = {
      ...(aluSystem.id ? { id: aluSystem.id } : {}),
      ...(aluSystem.code ? { code: aluSystem.code } : {}),
      ...(aluSystem.name ? { name: aluSystem.name } : {}),
      ...(aluSystem.description ? { description: aluSystem.description } : {}),
    };
  }
  return view;
}
