import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/content/ProductDetail';
import { getResidentialItem, residentialProducts } from '@/lib/residential-content';

export function generateStaticParams() { return residentialProducts.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = getResidentialItem(slug, 'product'); return item ? { title: item.title, description: item.summary, alternates: { canonical: `/nhom-dan-dung/dong-san-pham/${slug}` } } : {}; }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; const item = getResidentialItem(slug, 'product'); if (!item) notFound(); return <ProductDetail item={item} parentLabel="Dòng sản phẩm" parentHref="/nhom-dan-dung#products" />; }
