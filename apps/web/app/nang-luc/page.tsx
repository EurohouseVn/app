import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { capabilityTopics } from '@/lib/explore-data';

export const metadata: Metadata = { title: 'Năng lực EUROHOUSE', description: 'Tổng quan nhà máy, kiểm soát chất lượng, bề mặt, khuôn đùn và video năng lực EUROHOUSE.', alternates: { canonical: '/nang-luc' } };

export default function CapabilityPage() {
  return <><PageIntro eyebrow="NĂNG LỰC EUROHOUSE" title="Công bố năng lực bằng hồ sơ có thể kiểm chứng." summary="Số liệu nhà máy, thiết bị, dung sai và tiến độ chỉ xuất hiện sau khi có nguồn và phê duyệt kỹ thuật." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Năng lực' }]} actions={<Link className="home-button home-button-primary" href="/lien-he">Trao đổi yêu cầu <ArrowRight size={17} aria-hidden="true" /></Link>} />
    <section className="home-section capability-library"><div className="container"><header className="home-section-heading"><p className="home-eyebrow">Phạm vi công bố</p><h2>Từ môi trường sản xuất đến dữ liệu kỹ thuật.</h2></header><ContentGrid items={capabilityTopics.map((item) => ({ title: item.title, summary: item.summary, href: `/nang-luc/${item.slug}`, image: item.image }))} /></div></section>
    <section className="capability-governance"><div className="container"><p className="home-eyebrow">Nguyên tắc dữ liệu</p><h2>Không dùng con số chưa có nguồn để tạo ấn tượng.</h2><p>Các giới hạn thiết bị, vật liệu, dung sai, bảo hành và tiến độ được xác nhận theo hồ sơ được duyệt. Khi dữ liệu chưa đủ, website hướng người dùng đến đầu mối kỹ thuật.</p></div></section>
  </>;
}
