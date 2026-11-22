import { absoluteUrl } from './seo';
import { site } from './site';

const organizationId = `${site.url}/#organization`;
const websiteId = `${site.url}/#website`;

export type StructuredDataBreadcrumbItem = { label: string; href?: string };
export type VerifiedProperty = { name: string; value: string; verified: boolean };

export function buildOrganizationSchema(input: { sameAs?: readonly string[] } = {}) {
  const sameAs = input.sameAs?.filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': organizationId,
    name: site.brand,
    legalName: site.legalName,
    url: site.url,
    logo: absoluteUrl('/brand/eurohouse-logo-landscape.png'),
    email: site.email,
    telephone: site.phone,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.address,
      addressCountry: 'VN',
    },
    ...(sameAs?.length ? { sameAs } : {}),
  };
}

export function buildWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': websiteId,
    name: site.name,
    alternateName: site.brand,
    url: site.url,
    inLanguage: 'vi-VN',
    publisher: { '@id': organizationId },
  };
}

export function buildBreadcrumbSchema(items: readonly StructuredDataBreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

export function buildProductSchema(input: {
  name: string;
  description: string;
  url: string;
  image: string;
  category: string;
  sku?: string;
  properties?: readonly VerifiedProperty[];
}) {
  const additionalProperty = input.properties
    ?.filter((property) => property.verified)
    .map(({ name, value }) => ({ '@type': 'PropertyValue' as const, name, value }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    image: absoluteUrl(input.image),
    category: input.category,
    brand: { '@type': 'Brand', name: site.brand },
    manufacturer: { '@id': organizationId },
    ...(input.sku ? { sku: input.sku } : {}),
    ...(additionalProperty?.length ? { additionalProperty } : {}),
  };
}

export function buildServiceSchema(input: {
  name: string;
  description: string;
  url: string;
  serviceType: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    serviceType: input.serviceType,
    areaServed: { '@type': 'Country', name: 'Việt Nam' },
    provider: { '@id': organizationId },
  };
}

export function buildArticleSchema(input: {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
}) {
  const url = absoluteUrl(input.url);
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description,
    inLanguage: 'vi-VN',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    publisher: { '@id': organizationId },
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
    ...(input.datePublished ? { datePublished: input.datePublished } : {}),
    ...(input.dateModified ? { dateModified: input.dateModified } : {}),
  };
}

export function buildFaqSchema(items: readonly { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}
