import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { resourceEntries } from '@/lib/explore-data';

export const metadata: Metadata = { title: 'Tài nguyên', description: 'Catalog, hồ sơ năng lực, tài liệu kỹ thuật và video EUROHOUSE được quản trị theo phiên bản.', alternates: { canonical: '/tai-nguyen' } };
export default function ResourcesPage() { return <><PageIntro eyebrow="TRUNG TÂM TÀI NGUYÊN" title="Dùng đúng tài liệu, đúng phiên bản." summary="Mỗi tệp công khai đi kèm loại tài liệu, revision và ngày hiệu lực. Nội dung chưa duyệt không xuất hiện trong thư viện." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Tài nguyên' }]} /><section className="home-section"><div className="container"><ContentGrid items={resourceEntries.map((item) => ({ title: item.title, summary: item.summary, href: item.href, eyebrow: item.type }))} /></div></section></>; }
