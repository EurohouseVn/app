import type {
  PublicWebsiteContentDetail,
  PublicWebsiteContentSummary,
  WebsiteContentKind,
  WebsiteProductFamily,
} from '@eurohouse/types';

const DEFAULT_API_URL = 'https://api.nhomeurohouse.com/api';
const DEFAULT_REVALIDATE_SECONDS = 300;

export type PublicContentQuery = {
  family?: WebsiteProductFamily;
  kind?: WebsiteContentKind;
  q?: string;
  page?: number;
};

export type PublicSearchQuery = PublicContentQuery;

export type PaginatedPublicContent = {
  items: PublicWebsiteContentSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type PublicSearchResult = PaginatedPublicContent;

export class PublicApiError extends Error {
  readonly status: number | undefined;
  readonly url: string;

  constructor(message: string, url: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PublicApiError';
    this.status = status;
    this.url = url;
  }
}

export async function listPublishedContent(
  query: PublicContentQuery = {},
): Promise<PaginatedPublicContent> {
  return requestPublicJson<PaginatedPublicContent>(
    withQuery('/public/website/content', query),
    ['website-content'],
  );
}

export async function getPublishedContent(
  slug: string,
  locale = 'vi',
): Promise<PublicWebsiteContentDetail | null> {
  const normalizedSlug = slug.trim().toLowerCase();
  if (!normalizedSlug) return null;

  return requestPublicJson<PublicWebsiteContentDetail>(
    withQuery(`/public/website/content/${encodeURIComponent(normalizedSlug)}`, { locale }),
    ['website-content', `website-content:${normalizedSlug}`],
    { notFoundAsNull: true },
  );
}

export async function searchPublishedContent(
  query: PublicSearchQuery,
): Promise<PublicSearchResult> {
  return requestPublicJson<PublicSearchResult>(
    withQuery('/public/website/search', query),
    ['website-content', 'website-search'],
  );
}

type QueryValue = string | number | undefined;
type PublicQuery = Record<string, QueryValue>;

function withQuery(path: string, query: PublicQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    const normalized = typeof value === 'string' ? value.trim() : String(value);
    if (!normalized) continue;
    params.set(key, normalized);
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function requestPublicJson<T>(
  path: string,
  tags: string[],
  options: { notFoundAsNull: true },
): Promise<T | null>;
async function requestPublicJson<T>(path: string, tags: string[]): Promise<T>;
async function requestPublicJson<T>(
  path: string,
  tags: string[],
  options?: { notFoundAsNull?: boolean },
): Promise<T | null> {
  const url = `${serverApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: {
        revalidate: DEFAULT_REVALIDATE_SECONDS,
        tags,
      },
    });
  } catch (error) {
    throw new PublicApiError('Không thể kết nối dịch vụ nội dung EUROHOUSE.', url, undefined, {
      cause: error,
    });
  }

  if (response.status === 404 && options?.notFoundAsNull) return null;
  if (!response.ok) {
    throw new PublicApiError(
      `Dịch vụ nội dung EUROHOUSE phản hồi lỗi HTTP ${response.status}.`,
      url,
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new PublicApiError('Dịch vụ nội dung EUROHOUSE trả về dữ liệu không hợp lệ.', url, response.status, {
      cause: error,
    });
  }
}

function serverApiBaseUrl(): string {
  return (process.env.API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}
