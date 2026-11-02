import type { HomepageCard } from './homepage-content';

type FallbackCard = {
  slug: string;
  title: string;
  summary: string;
  image: string;
  href: string;
  family?: HomepageCard['family'];
};

export type HomepageDisplayCard = {
  slug: string;
  title: string;
  summary: string;
  image?: string;
  href: string;
  family?: HomepageCard['family'];
};

export function mergeResidentialSystems(
  content: readonly HomepageCard[],
  fallbacks: readonly FallbackCard[],
  limit = 3,
): HomepageDisplayCard[] {
  const fallbackBySlug = new Map(fallbacks.map((item) => [item.slug, item]));
  const used = new Set<string>();
  const cards: HomepageDisplayCard[] = [];

  for (const item of content) {
    if (cards.length >= limit || used.has(item.slug)) continue;
    const matchingFallback = fallbackBySlug.get(item.slug);
    cards.push({
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      image: item.image?.url ?? matchingFallback?.image,
      href: `/nhom-dan-dung/dong-san-pham/${item.slug}`,
      family: item.family,
    });
    used.add(item.slug);
  }

  for (const fallback of fallbacks) {
    if (cards.length >= limit || used.has(fallback.slug)) continue;
    cards.push({ ...fallback });
    used.add(fallback.slug);
  }

  return cards;
}

export function mergeHomepageProjects(
  content: readonly HomepageCard[],
  fallbacks: readonly FallbackCard[],
  limit = 3,
): HomepageDisplayCard[] {
  const used = new Set<string>();
  const cards: HomepageDisplayCard[] = [];

  for (const item of content) {
    if (cards.length >= limit || used.has(item.slug)) continue;
    cards.push({
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      image: item.image?.url,
      href: `/du-an/${item.slug}`,
      family: item.family,
    });
    used.add(item.slug);
  }

  for (const fallback of fallbacks) {
    if (cards.length >= limit || used.has(fallback.slug)) continue;
    cards.push({ ...fallback });
    used.add(fallback.slug);
  }

  return cards;
}

export function homepageFamilyLabel(family: HomepageCard['family']): string {
  if (family === 'RESIDENTIAL') return 'NHÔM DÂN DỤNG';
  if (family === 'INDUSTRIAL') return 'NHÔM CÔNG NGHIỆP';
  return 'ỨNG DỤNG EUROHOUSE';
}
