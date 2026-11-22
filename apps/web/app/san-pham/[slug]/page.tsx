import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, Download, ShieldCheck } from 'lucide-react';
import { notFound } from 'next/navigation';
import { StructuredData } from '@/components/StructuredData';
import { getProduct, products } from '@/lib/products';
import { buildPageMetadata } from '@/lib/seo';
import { buildProductSchema } from '@/lib/structured-data';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return buildPageMetadata({ title: `${product.name} – ${product.eyebrow}`, description: product.summary, canonicalPath: `/san-pham/${product.slug}`, image: product.profileImage, imageAlt: `Mặt cắt và ứng dụng hệ nhôm ${product.name} Eurohouse` });
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  return (
    <>
      <StructuredData data={buildProductSchema({ name: product.name, description: product.description, url: `/san-pham/${product.slug}`, image: product.profileImage, category: product.family, sku: product.code, properties: [{ name: 'Mã hệ', value: product.code, verified: true }, { name: 'Bảo hành bề mặt', value: product.warranty, verified: true }] })} />
      <section className="product-detail-hero">
        <Image src={product.image} alt={`Ứng dụng ${product.name}`} fill priority sizes="100vw" />
        <div className="product-detail-shade" />
        <div className="container product-detail-copy">
          <Link className="back-link" href="/san-pham"><ArrowLeft size={16} />Tất cả hệ nhôm</Link>
          <p className="hero-kicker">{product.family} · {product.code}</p>
          <h1>{product.name}</h1>
          <p>{product.summary}</p>
        </div>
      </section>
      <section className="section page-section">
        <div className="container detail-grid">
          <div>
            <p className="kicker">Tổng quan hệ</p>
            <h2>{product.eyebrow}</h2>
            <p className="detail-lead">{product.description}</p>
            <div className="feature-grid">
              {product.features.map((feature) => <div key={feature}><Check size={17} /><span>{feature}</span></div>)}
            </div>
            <div className="detail-actions">
              <Link className="button button-primary" href={`/lien-he?san-pham=${product.slug}`}>Yêu cầu tư vấn <ArrowRight size={18} /></Link>
              <Link className="button button-secondary" href="/catalog"><Download size={18} />Catalog kỹ thuật</Link>
            </div>
          </div>
          <aside className="spec-panel">
            <div className="profile-preview"><Image src={product.profileImage} alt={`Bảng mặt cắt ${product.name}`} fill sizes="(max-width: 800px) 100vw, 42vw" /></div>
            <dl>
              <div><dt>Mã hệ</dt><dd>{product.code}</dd></div>
              <div><dt>Bảo hành bề mặt</dt><dd><ShieldCheck size={16} />{product.warranty}</dd></div>
              <div><dt>Màu hoàn thiện</dt><dd>{product.colors.join(' · ')}</dd></div>
              <div><dt>Ứng dụng</dt><dd>{product.applications.join(' · ')}</dd></div>
            </dl>
          </aside>
        </div>
      </section>
    </>
  );
}
