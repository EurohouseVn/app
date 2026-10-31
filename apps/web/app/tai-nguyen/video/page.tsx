import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { publicVideos } from '@/lib/explore-data';

export const metadata: Metadata = { title: 'Thư viện video', description: 'Video EUROHOUSE có poster, mô tả, nội dung chữ và thông tin cập nhật.', alternates: { canonical: '/tai-nguyen/video' } };
export default function VideoLibraryPage() { return <><PageIntro eyebrow="THƯ VIỆN VIDEO" title="Xem quy trình, vẫn đọc được nội dung." summary="Video chỉ tải sau khi người dùng bấm phát. Mỗi nội dung có poster, chú thích và bản mô tả chữ để hỗ trợ tìm kiếm và tiếp cận." breadcrumbs={[{ label: 'Tài nguyên', href: '/tai-nguyen' }, { label: 'Video' }]} /><section className="home-section"><div className="container"><ContentGrid items={publicVideos.map((video) => ({ title: video.title, summary: video.summary, href: `/tai-nguyen/video/${video.slug}`, eyebrow: video.updatedLabel, image: video.posterUrl }))} /></div></section></>; }
