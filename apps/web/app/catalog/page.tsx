import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Download, FileText, RefreshCw } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Catalog nhôm Eurohouse',
  description: 'Tải catalog nhôm Eurohouse mới nhất do WebAdmin công bố, gồm hệ sản phẩm, màu và mặt cắt profile kỹ thuật.',
  alternates: { canonical: '/catalog' },
};

type CatalogItem = { id: string; title: string; description?: string | null; mediaUrl: string; updatedAt?: string };

async function getCatalogs(): Promise<CatalogItem[]> {
  try {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'https://api.nhomeurohouse.com/api';
    const response = await fetch(`${apiUrl}/content/library`, { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const items = (await response.json()) as Array<CatalogItem & { categoryId?: string; mediaType?: string }>;
    return items.filter((item) => item.categoryId === 'PRODUCT_CATALOG' || item.mediaType === 'DOCUMENT');
  } catch {
    return [];
  }
}

export default async function CatalogPage() {
  const catalogs = await getCatalogs();
  return (
    <>
      <section className="page-hero compact-hero"><div className="container"><p className="kicker">Tài liệu kỹ thuật</p><h1>Catalog Eurohouse</h1><p>Nguồn tài liệu chính thức được quản lý và cập nhật từ WebAdmin Eurohouse.</p></div></section>
      <section className="section page-section"><div className="container catalog-layout">
        <div><p className="kicker">Catalog EUROHOUSE</p><h2>Mặt cắt, tỷ trọng và ứng dụng hệ nhôm.</h2><p className="detail-lead">Tra cứu mã profile và thông tin hệ nhôm để chọn sản phẩm, chuẩn bị báo giá hoặc trao đổi phương án thi công.</p></div>
        <div className="catalog-list">
          {catalogs.length > 0 ? catalogs.map((catalog) => (
            <article key={catalog.id} className="catalog-item"><span><FileText size={22} /></span><div><h2>{catalog.title}</h2><p>{catalog.description || 'Catalog sản phẩm và mặt cắt kỹ thuật Eurohouse.'}</p></div><a className="button button-primary" href={catalog.mediaUrl} target="_blank" rel="noreferrer"><Download size={17} />Tải PDF</a></article>
          )) : (
            <div className="catalog-empty"><RefreshCw size={28} /><h2>Catalog đang được đồng bộ</h2><p>Khi WebAdmin công bố tài liệu mới, bản mới nhất sẽ tự động xuất hiện tại đây.</p><Link className="button button-secondary" href="/lien-he"><BookOpen size={17} />Yêu cầu gửi catalog</Link></div>
          )}
        </div>
      </div></section>
    </>
  );
}
