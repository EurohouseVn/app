import type { Metadata } from 'next';
import { site } from './site';

export type PageSeoInput = {
  title: string;
  description: string;
  canonicalPath: string;
  image: string;
  imageAlt: string;
  type?: 'website' | 'article';
};

export function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, `${site.url}/`).toString();
}

export function buildPageMetadata(input: PageSeoInput): Metadata {
  const title = stripBrandSuffix(input.title);
  const description = input.description.trim();
  if (!title) throw new Error('SEO title is required.');
  if (!description) throw new Error('SEO description is required.');

  const canonical = new URL(input.canonicalPath, `${site.url}/`);
  if (canonical.origin !== new URL(site.url).origin) {
    throw new Error('SEO canonical must use the production site origin.');
  }

  const image = absoluteUrl(input.image);
  const sharingTitle = /eurohouse/i.test(title) ? title : `${title} | Eurohouse`;

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: {
      type: input.type ?? 'website',
      locale: 'vi_VN',
      siteName: site.name,
      url: canonical.toString(),
      title: sharingTitle,
      description,
      images: [{ url: image, alt: input.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: sharingTitle,
      description,
      images: [image],
    },
  };
}

function stripBrandSuffix(value: string): string {
  return value.trim().replace(/\s*[|–—-]\s*eurohouse\s*$/i, '').trim();
}
