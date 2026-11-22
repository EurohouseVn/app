import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/content/ProductDetail';
import { getResidentialItem, residentialProducts } from '@/lib/residential-content';
import { buildPageMetadata } from '@/lib/seo';

export function generateStaticParams() { return residentialProducts.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = getResidentialItem(slug, 'product'); return item ? buildPageMetadata({ title: item.title, description: item.summary, canonicalPath: `/nhom-dan-dung/dong-san-pham/${slug}`, image: item.image || '/images/v4/installed-window.jpg', imageAlt: `Hệ nhôm dân dụng ${item.title} Eurohouse` }) : {}; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = getResidentialItem(slug, 'product'); if (!item) notFound(); return <ProductDetail item={item} parentLabel="Dòng sản phẩm" parentHref="/nhom-dan-dung#products" />; }
