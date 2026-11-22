import type { MetadataRoute } from 'next';
import { getIndexableRoutes } from '@/lib/indexable-routes';
import { site } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return getIndexableRoutes().map((route) => ({
    url: `${site.url}${route.path === '/' ? '/' : route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    ...(route.lastModified ? { lastModified: route.lastModified } : {}),
  }));
}
