import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StructuredData } from '@/components/StructuredData';
import { knowledgeArticles } from '@/lib/explore-data';
import { buildPageMetadata } from '@/lib/seo';
import { buildArticleSchema } from '@/lib/structured-data';

export function generateStaticParams() { return knowledgeArticles.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const article = knowledgeArticles.find((item) => item.slug === slug); return article ? buildPageMetadata({ title: article.title, description: article.summary, canonicalPath: `/kien-thuc/${article.slug}`, image: '/images/v4/aluminum-billets.jpg', imageAlt: `Kiến thức ngành nhôm: ${article.title}` , type: 'article' }) : {}; }
export default async function KnowledgeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const article = knowledgeArticles.find((item) => item.slug === slug); if (!article) notFound();
  return <><StructuredData data={buildArticleSchema({ headline: article.title, description: article.summary, url: `/kien-thuc/${article.slug}`, image: '/images/v4/aluminum-billets.jpg', datePublished: article.publishedAt, dateModified: article.modifiedAt })} /><article className="knowledge-article"><header><div className="container"><Breadcrumbs items={[{ label: 'Kiến thức', href: '/kien-thuc' }, { label: article.title }]} /><p className="home-eyebrow">{article.readingLabel} · Biên tập: {article.reviewedBy}</p><h1>{article.title}</h1><p>{article.summary}</p></div></header><div className="container knowledge-article-body">{article.sections.map((section) => <section key={section.title}><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.bullets ? <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>)}<aside><strong>Đọc tiếp theo chủ đề</strong>{article.relatedRoutes.map((route) => <Link href={route.href} key={route.href}>{route.label} <ArrowRight size={16} aria-hidden="true" /></Link>)}</aside></div></article></>;
}
