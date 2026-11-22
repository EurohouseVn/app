import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  const publicRule = (userAgent: string) => ({ userAgent, allow: '/', disallow: ['/api/'] });
  return {
    rules: [publicRule('*'), publicRule('Googlebot'), publicRule('Bingbot'), publicRule('OAI-SearchBot')],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
