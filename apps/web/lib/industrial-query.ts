export const INDUSTRIAL_SERVICE_SLUGS = [
  'dinh-hinh-theo-ban-ve',
  'chi-tiet-may',
  'nang-luong-mat-troi',
  'dun-thue',
  'gia-cong',
] as const;

export type IndustrialServiceSlug = (typeof INDUSTRIAL_SERVICE_SLUGS)[number];
export type IndustrialQuery = { q: string; services: IndustrialServiceSlug[]; applications: string[] };
export type IndustrialSearchItem = { slug: IndustrialServiceSlug; title: string; summary: string; applications: string[] };

export function normalizeIndustrialQuery(params: URLSearchParams): IndustrialQuery {
  const services = unique(params.getAll('service')).filter((value): value is IndustrialServiceSlug => INDUSTRIAL_SERVICE_SLUGS.includes(value as IndustrialServiceSlug));
  return { q: (params.get('q') || '').trim(), services, applications: unique(params.getAll('application').map((value) => value.trim()).filter(Boolean)) };
}

export function filterIndustrialServices<T extends IndustrialSearchItem>(items: readonly T[], query: IndustrialQuery): T[] {
  const term = foldVietnamese(query.q);
  return items.filter((item) => {
    if (query.services.length > 0 && !query.services.includes(item.slug)) return false;
    if (query.applications.length > 0 && !query.applications.some((application) => item.applications.includes(application))) return false;
    if (!term) return true;
    return foldVietnamese([item.title, item.summary, ...item.applications].join(' ')).includes(term);
  });
}

export function serializeIndustrialQuery(query: IndustrialQuery): string {
  const params = new URLSearchParams();
  const q = query.q.trim();
  if (q) params.set('q', q);
  for (const service of unique(query.services)) params.append('service', service);
  for (const application of unique(query.applications)) params.append('application', application);
  return params.toString();
}

export function foldVietnamese(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
