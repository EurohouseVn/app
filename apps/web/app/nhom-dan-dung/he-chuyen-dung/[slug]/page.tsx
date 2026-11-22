import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/content/ProductDetail';
import { getResidentialItem, specialistSystems } from '@/lib/residential-content';
import { buildPageMetadata } from '@/lib/seo';

export function generateStaticParams() { return specialistSystems.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = getResidentialItem(slug, 'specialist'); return item ? buildPageMetadata({ title: item.title, description: item.summary, canonicalPath: `/nhom-dan-dung/he-chuyen-dung/${slug}`, image: item.image || '/images/v4/installed-window.jpg', imageAlt: `Hệ nhôm chuyên dụng ${item.title} Eurohouse` }) : {}; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = getResidentialItem(slug, 'specialist'); if (!item) notFound(); return <ProductDetail item={item} parentLabel="Hệ chuyên dụng" parentHref="/nhom-dan-dung#specialist" />; }
