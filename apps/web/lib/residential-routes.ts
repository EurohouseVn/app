import type { WebsiteContentKind } from '@eurohouse/types';

type ResidentialRouteInput = { kind: Extract<WebsiteContentKind, 'PRODUCT' | 'SOLUTION'>; slug: string; specialist?: boolean };
type ResidentialCardInput = ResidentialRouteInput & { title: string; summary: string; image?: string; imageAlt?: string };

export function residentialContentHref(input: ResidentialRouteInput): string {
  const prefix = input.kind === 'SOLUTION'
    ? 'giai-phap'
    : input.specialist ? 'he-chuyen-dung' : 'dong-san-pham';
  return `/nhom-dan-dung/${prefix}/${input.slug}`;
}

export function toResidentialCard(input: ResidentialCardInput) {
  return {
    title: input.title,
    summary: input.summary,
    href: residentialContentHref(input),
    image: input.image,
    imageAlt: input.image ? (input.imageAlt || input.title) : undefined,
  };
}
