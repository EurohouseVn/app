import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { knowledgeArticles } from '@/lib/explore-data';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Kiến thức ngành nhôm', description: 'Hướng dẫn chọn hệ nhôm cho công trình, chuẩn bị bản vẽ nhôm công nghiệp, đọc catalog và trao đổi yêu cầu kỹ thuật với EUROHOUSE.', canonicalPath: '/kien-thuc', image: '/images/v4/aluminum-billets.jpg', imageAlt: 'Thư viện kiến thức ngành nhôm Eurohouse' });
export default function KnowledgePage() { return <><PageIntro eyebrow="KIẾN THỨC EUROHOUSE" title="Chọn hệ đúng hơn. Chuẩn bị hồ sơ nhanh hơn." summary="Tám hướng dẫn thực hành dành cho chủ công trình, xưởng nhôm kính, kỹ sư và doanh nghiệp đang tìm hiểu nhôm kiến trúc hoặc nhôm công nghiệp." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Kiến thức' }]} actions={<Link className="home-button home-button-primary" href="/cau-hoi-thuong-gap">Câu hỏi thường gặp <ArrowRight size={17} aria-hidden="true" /></Link>} /><section className="home-section"><div className="container"><ContentGrid items={knowledgeArticles.map((item) => ({ title: item.title, summary: item.summary, href: `/kien-thuc/${item.slug}`, eyebrow: `${item.topicCluster === 'INDUSTRIAL' ? 'Nhôm công nghiệp' : 'Nhôm dân dụng'} · ${item.readingLabel}` }))} /></div></section></>; }
