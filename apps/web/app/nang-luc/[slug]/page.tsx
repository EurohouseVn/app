import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { capabilityTopics } from '@/lib/explore-data';

export function generateStaticParams() { return capabilityTopics.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const item = capabilityTopics.find((entry) => entry.slug === slug); return item ? { title: item.title, description: item.summary, alternates: { canonical: `/nang-luc/${item.slug}` } } : {}; }

export default async function CapabilityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const item = capabilityTopics.find((entry) => entry.slug === slug); if (!item) notFound();
  return <><section className="capability-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Năng lực', href: '/nang-luc' }, { label: item.title }]} /><div className="capability-detail-grid"><div><p className="home-eyebrow">Năng lực được quản trị</p><h1>{item.title}</h1><p>{item.summary}</p></div><div className="capability-detail-image"><Image src={item.image} alt={`Hình ảnh minh họa cho ${item.title}`} fill unoptimized sizes="(max-width: 800px) 100vw, 52vw" /></div></div></div></section>
    <section className="home-section"><div className="container capability-scope"><div><p className="home-eyebrow">Phạm vi thông tin</p><h2>Nội dung có thể trao đổi.</h2></div><ul>{item.scope.map((scope) => <li key={scope}><CheckCircle2 size={20} aria-hidden="true" /><span>{scope}</span></li>)}</ul></div></section>
    <section className="capability-confirm"><div className="container"><div><p className="home-eyebrow">Thông số chi tiết</p><h2>Liên hệ xác nhận kỹ thuật.</h2><p>Website không công bố số liệu chưa có nguồn, phiên bản và người duyệt.</p></div><Link className="home-button home-button-primary" href={item.slug === 'video' ? '/tai-nguyen/video' : '/lien-he'}>{item.slug === 'video' ? 'Mở thư viện video' : 'Liên hệ kỹ thuật'} <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </>;
}
