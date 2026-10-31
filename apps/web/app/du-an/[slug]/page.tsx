import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { DocumentList } from '@/components/content/DocumentList';
import { getPublishedContent } from '@/lib/public-api';
import { publishedSections, publishedSpecifications } from '@/lib/explore-content';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const content = await safeProject((await params).slug); return content ? { title: content.seo.title || content.title, description: content.seo.description || content.summary, alternates: { canonical: `/du-an/${content.slug}` } } : {}; }

export default async function ProjectDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const content = await safeProject((await params).slug); if (!content) notFound();
  const image = content.media.find((item) => item.mediaType === 'IMAGE');
  const sections = publishedSections(content.body);
  const specifications = publishedSpecifications(content.specifications);
  return <><section className="project-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Dự án', href: '/du-an' }, { label: content.title }]} /><div className="project-detail-grid"><div><p className="home-eyebrow">Case study đã xuất bản</p><h1>{content.title}</h1><p>{content.summary}</p></div><div className="project-detail-media">{image ? <Image src={image.url} alt={image.altText} fill unoptimized sizes="(max-width: 800px) 100vw, 52vw" /> : <span>Chưa có hình ảnh công khai</span>}</div></div></div></section>
    <section className="home-section"><div className="container project-detail-body"><article>{sections.length ? sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>) : <><h2>Bối cảnh dự án</h2><p>Nội dung chi tiết đang chờ hoàn thiện trong hồ sơ xuất bản.</p></>}</article><aside><h2>Thông tin được xác nhận</h2><dl>{content.linkedSystem ? <div><dt>Hệ EUROHOUSE</dt><dd>{content.linkedSystem.name}</dd></div> : null}{specifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{!content.linkedSystem && !specifications.length ? <div><dt>Thông số</dt><dd>Liên hệ xác nhận kỹ thuật</dd></div> : null}</dl></aside></div></section>
    <section className="home-section residential-documents"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Tài liệu dự án</p><h2>Hồ sơ đã được phép công khai.</h2></header><DocumentList documents={content.documents} /></div></section>
    <section className="industrial-detail-cta"><div className="container"><h2>Cần giải pháp cho dự án tương tự?</h2><Link className="home-button home-button-primary" href="/lien-he">Trao đổi dự án <ArrowRight size={17} aria-hidden="true" /></Link></div></section>
  </>;
}

async function safeProject(slug: string) { try { const content = await getPublishedContent(slug); return content?.kind === 'CASE_STUDY' ? content : null; } catch { return null; } }
