import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ConsultationCta } from '@/components/content/ConsultationCta';
import { residentialProducts, residentialSolutions, specialistSystems } from '@/lib/residential-content';

export const metadata: Metadata = { title: 'Nhôm dân dụng', description: 'Hệ nhôm EUROHOUSE cho nhà ở, biệt thự, công trình và dự án.', alternates: { canonical: '/nhom-dan-dung' } };

export default function ResidentialPage() {
  return <>
    <PageIntro eyebrow="NHÔM DÂN DỤNG" title="Hệ nhôm cho kiến trúc, nhà ở và dự án." summary="Tra cứu theo dòng sản phẩm, hệ chuyên dụng hoặc loại công trình. Mọi thông số kỹ thuật chỉ được hiển thị khi đã có nguồn công bố." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Nhôm dân dụng' }]} />
    <ResidentialGroup id="products" eyebrow="Dòng sản phẩm" title="Bốn nền tảng sản phẩm chủ lực." items={residentialProducts} prefix="/nhom-dan-dung/dong-san-pham" />
    <ResidentialGroup id="specialist" eyebrow="Hệ chuyên dụng" title="Giải pháp theo khẩu độ và cách vận hành." items={specialistSystems} prefix="/nhom-dan-dung/he-chuyen-dung" muted />
    <section className="home-section residential-solutions"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Theo loại công trình</p><h2>Đi từ nhu cầu sử dụng đến hệ nhôm phù hợp.</h2></header><div className="solution-link-grid">{residentialSolutions.map((item) => <Link href={`/nhom-dan-dung/giai-phap/${item.slug}`} key={item.slug}><strong>{item.title}</strong><span>{item.summary}</span><ArrowRight size={17} aria-hidden="true" /></Link>)}</div><div className="residential-secondary-links"><Link href="/nhom-dan-dung/so-sanh">So sánh hệ nhôm</Link><Link href="/nhom-dan-dung/du-an">Xem dự án dân dụng</Link></div></div></section>
    <ConsultationCta />
  </>;
}

function ResidentialGroup({ id, eyebrow, title, items, prefix, muted = false }: { id: string; eyebrow: string; title: string; items: typeof residentialProducts; prefix: string; muted?: boolean }) {
  return <section className={`home-section residential-group${muted ? ' is-muted' : ''}`} id={id}><div className="container"><header className="home-section-heading"><p className="home-eyebrow">{eyebrow}</p><h2>{title}</h2></header><div className="residential-card-grid">{items.map((item) => <Link href={`${prefix}/${item.slug}`} key={item.slug}><span className="residential-card-media">{item.image ? <Image src={item.image} alt={`${item.title} EUROHOUSE`} fill unoptimized sizes="(max-width: 640px) 100vw, 33vw" /> : null}</span><span className="residential-card-copy"><small>{item.code || eyebrow}</small><strong>{item.title}</strong><span>{item.summary}</span><b>Xem chi tiết <ArrowRight size={16} aria-hidden="true" /></b></span></Link>)}</div></div></section>;
}
