import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Upload } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StructuredData } from '@/components/StructuredData';
import { DocumentList } from '@/components/content/DocumentList';
import { IndustrialProcess } from '@/components/industrial/IndustrialProcess';
import { getIndustrialService, industrialServices } from '@/lib/industrial-content';
import { buildPageMetadata } from '@/lib/seo';
import { buildServiceSchema } from '@/lib/structured-data';

export function generateStaticParams() { return [...industrialServices.map(({ slug }) => ({ slug })), { slug: 'quy-trinh' }]; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; if (slug === 'quy-trinh') return buildPageMetadata({ title: 'Quy trình nhôm công nghiệp', description: 'Tìm hiểu các bước tiếp nhận bản vẽ, rà soát yêu cầu, xác nhận phương án và triển khai sản phẩm nhôm công nghiệp cùng EUROHOUSE.', canonicalPath: '/nhom-cong-nghiep/quy-trinh', image: '/images/v4/factory-coating-line.jpg', imageAlt: 'Quy trình sản xuất nhôm công nghiệp Eurohouse' }); const service = getIndustrialService(slug); return service ? buildPageMetadata({ title: service.title, description: service.summary, canonicalPath: `/nhom-cong-nghiep/${slug}`, image: service.image, imageAlt: `${service.title} tại Eurohouse` }) : {}; }

export default async function IndustrialDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === 'quy-trinh') return <><StructuredData data={buildServiceSchema({ name: 'Quy trình nhôm công nghiệp', description: 'Các bước tiếp nhận bản vẽ, rà soát yêu cầu, xác nhận phương án và triển khai sản phẩm nhôm công nghiệp cùng EUROHOUSE.', url: '/nhom-cong-nghiep/quy-trinh', serviceType: 'Quy trình hỗ trợ nhôm công nghiệp' })} /><section className="industrial-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: 'Quy trình' }]} /><p className="home-eyebrow">Quy trình công nghiệp</p><h1>Từ hồ sơ kỹ thuật đến bước triển khai.</h1><p>Mỗi yêu cầu được rà soát theo dữ liệu thực tế trước khi xác nhận phạm vi.</p></div></section><IndustrialProcess /></>;
  const service = getIndustrialService(slug); if (!service) notFound();
  return <>
    <StructuredData data={buildServiceSchema({ name: service.title, description: service.summary, url: `/nhom-cong-nghiep/${service.slug}`, serviceType: 'Dịch vụ nhôm công nghiệp' })} />
    <section className="industrial-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: service.title }]} /><div className="industrial-detail-grid"><div><p className="home-eyebrow">{service.eyebrow}</p><h1>{service.title}</h1><p>{service.summary}</p><Link className="home-button home-button-primary" href={`/yeu-cau-bao-gia-cong-nghiep?service=${service.slug}`}><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link></div><div className="industrial-detail-image"><Image src={service.image} alt={`Năng lực phục vụ ${service.title}`} fill unoptimized sizes="(max-width: 800px) 100vw, 50vw" /></div></div></div></section>
    <section className="home-section"><div className="container industrial-detail-content"><article><h2>Dịch vụ này là gì?</h2><p>{service.definition}</p><h2>Phù hợp với nhu cầu nào?</h2><ul>{service.suitableFor.map((item) => <li key={item}>{item}</li>)}</ul><h2>Giá trị khách hàng nhận được</h2><ul>{service.benefits.map((item) => <li key={item}>{item}</li>)}</ul><h2>Quy trình phối hợp</h2><ol>{service.process.map((item) => <li key={item}>{item}</li>)}</ol></article><aside><h2>Dữ liệu nên chuẩn bị</h2><ul>{service.requiredInputs.map((item) => <li key={item}>{item}</li>)}</ul><h2>Kết quả trao đổi ban đầu</h2><ul>{service.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></aside></div></section>
    <section className="home-section"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Câu hỏi thường gặp</p><h2>Chuẩn bị tốt trước khi gửi hồ sơ.</h2></header><div className="solution-link-grid">{service.faq.map((item) => <article key={item.question}><strong>{item.question}</strong><p>{item.answer}</p></article>)}</div><div className="residential-secondary-links">{service.relatedLinks.map((link) => <Link href={link.href} key={link.href}>{link.label}</Link>)}</div></div></section>
    <section className="home-section residential-documents"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Tài liệu được duyệt</p><h2>Hồ sơ liên quan đến dịch vụ.</h2></header><DocumentList /></div></section>
    <section className="industrial-detail-cta"><div className="container"><h2>Có bản vẽ hoặc mẫu sản phẩm?</h2><Link className="home-button home-button-primary" href={`/yeu-cau-bao-gia-cong-nghiep?service=${service.slug}`}>Gửi yêu cầu kỹ thuật <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </>;
}
