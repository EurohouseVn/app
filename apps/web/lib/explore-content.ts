import type { PublicDocumentProjection, WebsiteContentKind, WebsiteProductFamily } from '@eurohouse/types';

export const PROJECT_TYPES = ['Biệt thự', 'Nhà phố', 'Chung cư', 'Thương mại', 'Khách sạn', 'Công nghiệp'] as const;
export const PROJECT_REGIONS = ['Hà Nội', 'Hưng Yên', 'Miền Bắc', 'Miền Trung', 'Miền Nam'] as const;
export const PROJECT_SYSTEMS = ['ECENTO 70', 'ECENTO PLUS', 'Hệ 55 vát cạnh', 'PRECO', 'Hệ chuyên dụng'] as const;
export const PROJECT_YEARS = ['2026', '2025', '2024', '2023'] as const;

export type ProjectSummary = {
  slug: string;
  title: string;
  summary: string;
  type?: string;
  region?: string;
  system?: string;
  year?: string;
  image?: string;
};

export type ProjectQuery = {
  q: string;
  types: string[];
  regions: string[];
  systems: string[];
  years: string[];
};

export type SiteSearchEntry = {
  title: string;
  summary: string;
  href: string;
  kind: string;
};

export type PublishedSection = { title: string; paragraphs: string[] };

export function normalizeProjectQuery(params: URLSearchParams): ProjectQuery {
  return {
    q: params.get('q')?.trim() || '',
    types: accepted(params.getAll('type'), PROJECT_TYPES),
    regions: accepted(params.getAll('region'), PROJECT_REGIONS),
    systems: accepted(params.getAll('system'), PROJECT_SYSTEMS),
    years: accepted(params.getAll('year'), PROJECT_YEARS),
  };
}

export function filterProjects(items: readonly ProjectSummary[], query: ProjectQuery): ProjectSummary[] {
  const q = foldVietnamese(query.q);
  return items.filter((item) => {
    const searchable = foldVietnamese([item.title, item.summary, item.type, item.region, item.system, item.year].filter(Boolean).join(' '));
    return (!q || searchable.includes(q))
      && (!query.types.length || query.types.includes(item.type || ''))
      && (!query.regions.length || query.regions.includes(item.region || ''))
      && (!query.systems.length || query.systems.includes(item.system || ''))
      && (!query.years.length || query.years.includes(item.year || ''));
  });
}

export function serializeProjectQuery(query: ProjectQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  for (const value of query.types) params.append('type', value);
  for (const value of query.regions) params.append('region', value);
  for (const value of query.systems) params.append('system', value);
  for (const value of query.years) params.append('year', value);
  return params.toString();
}

export function safeTechnicalValue(value: string | undefined, sourceVerified: boolean): string {
  return sourceVerified && value?.trim() ? value.trim() : 'Liên hệ xác nhận kỹ thuật';
}

export function publishedSections(body: unknown): PublishedSection[] {
  if (!isRecord(body) || !Array.isArray(body.sections)) return [];
  return body.sections.flatMap((section) => {
    if (!isRecord(section) || typeof section.title !== 'string' || !section.title.trim() || !Array.isArray(section.paragraphs)) return [];
    const paragraphs = section.paragraphs.filter((paragraph): paragraph is string => typeof paragraph === 'string' && Boolean(paragraph.trim())).map((paragraph) => paragraph.trim());
    return paragraphs.length ? [{ title: section.title.trim(), paragraphs }] : [];
  });
}

export function publishedSpecifications(value: unknown): Array<[string, string]> {
  if (!isRecord(value)) return [];
  return Object.entries(value).filter((entry): entry is [string, string] => Boolean(entry[0].trim()) && typeof entry[1] === 'string' && Boolean(entry[1].trim())).map(([key, item]) => [key.trim(), item.trim()]);
}

export function groupDocumentsByType(documents: readonly PublicDocumentProjection[]) {
  const groups = new Map<string, PublicDocumentProjection[]>();
  for (const document of documents) groups.set(document.documentType, [...(groups.get(document.documentType) || []), document]);
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([type, entries]) => ({ type, documents: entries }));
}

export function searchSiteIndex(index: readonly SiteSearchEntry[], query: string): SiteSearchEntry[] {
  const q = foldVietnamese(query.trim());
  if (!q) return [];
  return index.filter((entry) => foldVietnamese(`${entry.title} ${entry.summary} ${entry.kind}`).includes(q));
}

export function publicContentHref(kind: WebsiteContentKind, slug: string, family?: WebsiteProductFamily): string {
  if (kind === 'CASE_STUDY') return `/du-an/${slug}`;
  if (kind === 'VIDEO') return `/tai-nguyen/video/${slug}`;
  if (kind === 'ARTICLE' || kind === 'FAQ') return `/kien-thuc/${slug}`;
  if (kind === 'PRODUCT' || family === 'RESIDENTIAL') return `/nhom-dan-dung/dong-san-pham/${slug}`;
  if (kind === 'INDUSTRIAL_SERVICE' || family === 'INDUSTRIAL') return `/nhom-cong-nghiep/${slug}`;
  return `/${slug}`;
}

export function foldVietnamese(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

function accepted(values: string[], allowed: readonly string[]): string[] {
  return [...new Set(values.filter((value) => allowed.includes(value)))];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
