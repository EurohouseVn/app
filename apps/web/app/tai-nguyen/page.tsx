import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { resourceEntries } from '@/lib/explore-data';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Catalog và tài nguyên Eurohouse', description: 'Tải catalog nhôm EUROHOUSE, xem hồ sơ năng lực, tài liệu kỹ thuật, bản vẽ và video giới thiệu sản phẩm theo từng nhu cầu.', canonicalPath: '/tai-nguyen', image: '/images/v4/ecento-70.jpg', imageAlt: 'Catalog và tài liệu kỹ thuật nhôm Eurohouse' });
export default function ResourcesPage() { return <><PageIntro eyebrow="TRUNG TÂM TÀI NGUYÊN" title="Tìm catalog và bản vẽ nhanh hơn." summary="Catalog, hồ sơ năng lực, tài liệu kỹ thuật và video được sắp xếp theo nhu cầu để chủ nhà, thợ và đối tác dự án dễ tra cứu." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Tài nguyên' }]} /><section className="home-section"><div className="container"><ContentGrid items={resourceEntries.map((item) => ({ title: item.title, summary: item.summary, href: item.href, eyebrow: item.type }))} /></div></section></>; }
