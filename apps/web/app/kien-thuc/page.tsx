import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { knowledgeArticles } from '@/lib/explore-data';

export const metadata: Metadata = { title: 'Kiến thức về nhôm', description: 'Hướng dẫn lựa chọn hệ nhôm, chuẩn bị hồ sơ kỹ thuật và sử dụng tài liệu đúng phiên bản.', alternates: { canonical: '/kien-thuc' } };
export default function KnowledgePage() { return <><PageIntro eyebrow="KIẾN THỨC EUROHOUSE" title="Câu trả lời rõ trước, chi tiết kỹ thuật sau." summary="Nội dung giúp người đọc chuẩn bị yêu cầu và đọc tài liệu đúng cách; không thay thế xác nhận kỹ thuật theo công trình." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Kiến thức' }]} actions={<Link className="home-button home-button-primary" href="/cau-hoi-thuong-gap">Câu hỏi thường gặp <ArrowRight size={17} aria-hidden="true" /></Link>} /><section className="home-section"><div className="container"><ContentGrid items={knowledgeArticles.map((item) => ({ title: item.title, summary: item.summary, href: `/kien-thuc/${item.slug}`, eyebrow: item.readingLabel }))} /></div></section></>; }
