import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { capabilityTopics } from '@/lib/explore-data';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Năng lực sản xuất nhôm Eurohouse', description: 'Khám phá nhà máy, phát triển khuôn, công nghệ bề mặt, kiểm soát chất lượng và năng lực phục vụ nhôm kiến trúc lẫn nhôm công nghiệp.', canonicalPath: '/nang-luc', image: '/images/v4/factory-yard.jpg', imageAlt: 'Nhà máy và năng lực sản xuất nhôm Eurohouse' });

export default function CapabilityPage() {
  return <><PageIntro eyebrow="NĂNG LỰC EUROHOUSE" title="Từ ý tưởng sản phẩm đến profile hoàn thiện." summary="Khám phá nhà máy, công nghệ bề mặt, quy trình phát triển khuôn và cách EUROHOUSE đồng hành với nhu cầu nhôm kiến trúc lẫn nhôm công nghiệp." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Năng lực' }]} actions={<Link className="home-button home-button-primary" href="/lien-he">Trao đổi yêu cầu <ArrowRight size={17} aria-hidden="true" /></Link>} />
    <section className="home-section capability-library"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Phạm vi công bố</p><h2>Từ môi trường sản xuất đến dữ liệu kỹ thuật.</h2></header><ContentGrid items={capabilityTopics.map((item) => ({ title: item.title, summary: item.summary, href: `/nang-luc/${item.slug}`, image: item.image }))} /></div></section>
    <section className="capability-governance"><div className="container"><p className="home-eyebrow">Nguyên tắc dữ liệu</p><h2>Không dùng con số chưa có nguồn để tạo ấn tượng.</h2><p>Các giới hạn thiết bị, vật liệu, dung sai, bảo hành và tiến độ được xác nhận theo hồ sơ được duyệt. Khi dữ liệu chưa đủ, website hướng người dùng đến đầu mối kỹ thuật.</p></div></section>
  </>;
}
