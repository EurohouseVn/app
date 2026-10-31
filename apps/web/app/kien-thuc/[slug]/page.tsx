import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { knowledgeArticles } from '@/lib/explore-data';

export function generateStaticParams() { return knowledgeArticles.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const article = knowledgeArticles.find((item) => item.slug === slug); return article ? { title: article.title, description: article.summary, alternates: { canonical: `/kien-thuc/${article.slug}` } } : {}; }
export default async function KnowledgeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = knowledgeArticles.find((item) => item.slug === slug); if (!article) notFound();
  return <><article className="knowledge-article"><header><div className="container"><Breadcrumbs items={[{ label: 'Kiến thức', href: '/kien-thuc' }, { label: article.title }]} /><p className="home-eyebrow">{article.readingLabel}</p><h1>{article.title}</h1><p>{article.summary}</p></div></header><div className="container knowledge-article-body">{article.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>)}<aside><strong>Cần xác nhận theo hồ sơ thực tế?</strong><Link href="/lien-he">Liên hệ EUROHOUSE <ArrowRight size={16} aria-hidden="true" /></Link></aside></div></article></>;
}
