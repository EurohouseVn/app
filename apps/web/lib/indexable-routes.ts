import type { MetadataRoute } from 'next';
import { capabilityTopics, knowledgeArticles, publicVideos } from './explore-data';
import { industrialServices } from './industrial-content';
import { products } from './products';
import { publicRouteManifest } from './public-routes';
import { residentialProducts, residentialSolutions, specialistSystems } from './residential-content';

export type IndexableRouteSource = 'static' | 'product' | 'residential' | 'industrial' | 'knowledge' | 'capability' | 'video';
export type IndexableRoute = {
  path: `/${string}` | '/';
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
  lastModified?: string;
  source: IndexableRouteSource;
};

const legacyIndexablePaths = ['/san-pham', '/catalog', '/he-sinh-thai'] as const;

export function getIndexableRoutes(): IndexableRoute[] {
  const routes: IndexableRoute[] = [
    ...publicRouteManifest
      .filter((route) => !route.external && !route.dynamic && route.kind !== 'support' && route.id !== 'search')
      .map((route) => entry(route.canonicalPath as `/${string}` | '/', 'static', route.canonicalPath === '/' ? 1 : 0.7)),
    ...legacyIndexablePaths.map((path) => entry(path, 'static', 0.6)),
    ...products.map(({ slug }) => entry(`/san-pham/${slug}`, 'product', 0.8)),
    ...residentialProducts.map(({ slug }) => entry(`/nhom-dan-dung/dong-san-pham/${slug}`, 'residential', 0.85)),
    ...specialistSystems.map(({ slug }) => entry(`/nhom-dan-dung/he-chuyen-dung/${slug}`, 'residential', 0.8)),
    ...residentialSolutions.map(({ slug }) => entry(`/nhom-dan-dung/giai-phap/${slug}`, 'residential', 0.75)),
    ...industrialServices.map(({ slug }) => entry(`/nhom-cong-nghiep/${slug}`, 'industrial', 0.85)),
    entry('/nhom-cong-nghiep/quy-trinh', 'industrial', 0.75),
    ...knowledgeArticles.map(({ slug }) => entry(`/kien-thuc/${slug}`, 'knowledge', 0.7)),
    ...capabilityTopics.map(({ slug }) => entry(`/nang-luc/${slug}`, 'capability', 0.7)),
    ...publicVideos.map(({ slug }) => entry(`/tai-nguyen/video/${slug}`, 'video', 0.65)),
  ];

  const unique = new Map(routes.map((route) => [route.path, route]));
  return [...unique.values()].sort((left, right) => {
    if (left.path === '/') return -1;
    if (right.path === '/') return 1;
    return left.path.localeCompare(right.path, 'vi');
  });
}

function entry(path: `/${string}` | '/', source: IndexableRouteSource, priority: number): IndexableRoute {
  return { path, source, priority, changeFrequency: path === '/' ? 'weekly' : 'monthly' };
}
