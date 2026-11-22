import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { StructuredData } from '@/components/StructuredData';
import { VideoPlayer } from '@/components/explore/VideoPlayer';
import { publicVideos } from '@/lib/explore-data';
import { buildVideoSchema } from '@/lib/video-metadata';

export function generateStaticParams() { return publicVideos.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const video = publicVideos.find((item) => item.slug === slug); return video ? { title: video.title, description: video.summary, alternates: { canonical: `/tai-nguyen/video/${video.slug}` } } : {}; }
export default async function VideoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const video = publicVideos.find((item) => item.slug === slug); if (!video) notFound();
  const schema = buildVideoSchema({ name: video.title, description: video.summary, thumbnailUrl: video.posterUrl, contentUrl: video.url, transcript: video.transcript });
  return <>{schema ? <StructuredData data={schema} /> : null}<section className="video-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Video', href: '/tai-nguyen/video' }, { label: video.title }]} /><p className="home-eyebrow">{video.updatedLabel}</p><h1>{video.title}</h1><p>{video.summary}</p></div></section>
    <section className="home-section video-detail-body"><div className="container"><VideoPlayer video={video} /><aside><p className="home-eyebrow">Nội dung video</p><h2>Bản mô tả có thể đọc</h2><p>{video.transcript}</p><Link className="home-text-link" href="/nang-luc">Xem năng lực EUROHOUSE <ArrowRight size={16} aria-hidden="true" /></Link></aside></div></section>
  </>;
}
