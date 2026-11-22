import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/content/ProductDetail';
import { getResidentialItem, residentialSolutions } from '@/lib/residential-content';
import { buildPageMetadata } from '@/lib/seo';

export function generateStaticParams() { return residentialSolutions.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = getResidentialItem(slug, 'solution'); return item ? buildPageMetadata({ title: `Giải pháp nhôm cho ${item.title}`, description: item.summary, canonicalPath: `/nhom-dan-dung/giai-phap/${slug}`, image: item.image || '/images/v4/hero-house.webp', imageAlt: `Giải pháp nhôm Eurohouse cho ${item.title}` }) : {}; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = getResidentialItem(slug, 'solution'); if (!item) notFound(); return <ProductDetail item={item} parentLabel="Giải pháp" parentHref="/nhom-dan-dung" />; }
