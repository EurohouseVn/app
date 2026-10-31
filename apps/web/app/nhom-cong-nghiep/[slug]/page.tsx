import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Upload } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DocumentList } from '@/components/content/DocumentList';
import { IndustrialProcess } from '@/components/industrial/IndustrialProcess';
import { getIndustrialService, industrialServices } from '@/lib/industrial-content';

export function generateStaticParams() { return [...industrialServices.map(({ slug }) => ({ slug })), { slug: 'quy-trinh' }]; }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; if (slug === 'quy-trinh') return { title: 'Quy trình nhôm công nghiệp', alternates: { canonical: '/nhom-cong-nghiep/quy-trinh' } }; const service = getIndustrialService(slug); return service ? { title: service.title, description: service.summary, alternates: { canonical: `/nhom-cong-nghiep/${slug}` } } : {}; }

export default async function IndustrialDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === 'quy-trinh') return <><section className="industrial-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: 'Quy trình' }]} /><p className="home-eyebrow">Quy trình công nghiệp</p><h1>Từ hồ sơ kỹ thuật đến bước triển khai.</h1><p>Mỗi yêu cầu được rà soát theo dữ liệu thực tế trước khi xác nhận phạm vi.</p></div></section><IndustrialProcess /></>;
  const service = getIndustrialService(slug); if (!service) notFound();
  return <>
    <section className="industrial-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: service.title }]} /><div className="industrial-detail-grid"><div><p className="home-eyebrow">{service.eyebrow}</p><h1>{service.title}</h1><p>{service.summary}</p><Link className="home-button home-button-primary" href={`/yeu-cau-bao-gia-cong-nghiep?service=${service.slug}`}><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link></div><div className="industrial-detail-image"><Image src={service.image} alt={`Năng lực phục vụ ${service.title}`} fill unoptimized sizes="(max-width: 800px) 100vw, 50vw" /></div></div></div></section>
    <section className="home-section"><div className="container industrial-detail-content"><article><h2>Phạm vi tiếp nhận</h2><p>{service.description}</p><h2>Thông tin phản hồi</h2><ul>{service.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></article><aside><h2>Thông số kỹ thuật</h2><dl>{['Vật liệu và trạng thái', 'Dung sai', 'Bề mặt', 'Sản lượng tối thiểu', 'Tiến độ'].map((label) => <div key={label}><dt>{label}</dt><dd>Liên hệ xác nhận kỹ thuật</dd></div>)}</dl></aside></div></section>
    <section className="home-section residential-documents"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Tài liệu được duyệt</p><h2>Hồ sơ liên quan đến dịch vụ.</h2></header><DocumentList /></div></section>
    <section className="industrial-detail-cta"><div className="container"><h2>Có bản vẽ hoặc mẫu sản phẩm?</h2><Link className="home-button home-button-primary" href={`/yeu-cau-bao-gia-cong-nghiep?service=${service.slug}`}>Gửi yêu cầu kỹ thuật <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </>;
}
