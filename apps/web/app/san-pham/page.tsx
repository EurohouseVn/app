import type { Metadata } from 'next';
import { ProductCard } from '@/components/ProductCard';
import { products, specialistProducts, strategicProducts } from '@/lib/products';
import { StructuredData } from '@/components/StructuredData';
import { site } from '@/lib/site';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Hệ nhôm Eurohouse và sản phẩm', description: 'Tra cứu ECENTO 70, ECENTO PLUS, Hệ 55 Vát Cạnh, PRECO cùng các hệ cửa và mặt dựng chuyên dụng của EUROHOUSE.', canonicalPath: '/san-pham', image: '/images/v4/ecento-70.jpg', imageAlt: 'Các hệ nhôm và sản phẩm Eurohouse' });

export default function ProductsPage() {
  return (
    <>
      <StructuredData data={{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Hệ nhôm Eurohouse', url: `${site.url}/san-pham`, mainEntity: products.map((product) => ({ '@type': 'Product', name: product.name, url: `${site.url}/san-pham/${product.slug}`, category: product.family })) }} />
      <section className="page-hero compact-hero">
        <div className="container"><p className="kicker">Danh mục sản phẩm</p><h1>Hệ nhôm Eurohouse</h1><p>Tra cứu từng hệ theo ứng dụng, màu, bảo hành và dữ liệu mặt cắt kỹ thuật.</p></div>
      </section>
      <section className="section page-section">
        <div className="container">
          <div className="section-heading"><p className="kicker">Dòng sản phẩm</p><h2>Nền tảng cho cửa và vách nhôm kính.</h2></div>
          <div className="product-grid">{strategicProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
        </div>
      </section>
      <section className="section systems-section">
        <div className="container">
          <div className="section-heading"><p className="kicker">Hệ chuyên dụng</p><h2>Giải pháp theo yêu cầu kiến trúc.</h2></div>
          <div className="product-grid">{specialistProducts.map((product) => <ProductCard key={product.slug} product={product} />)}</div>
        </div>
      </section>
    </>
  );
}
