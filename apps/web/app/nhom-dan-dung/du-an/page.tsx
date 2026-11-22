import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { ConsultationCta } from '@/components/content/ConsultationCta';

export const metadata: Metadata = { title: 'Dự án nhôm dân dụng', description: 'Ứng dụng và dự án tham khảo của hệ nhôm EUROHOUSE.', alternates: { canonical: '/nhom-dan-dung/du-an' } };
export default function ResidentialProjectsPage() { return <><PageIntro eyebrow="Ứng dụng thực tế" title="Dự án nhôm dân dụng." summary="Hình ảnh được trình bày theo hồ sơ hiện có. Các thông tin về bên tham gia và thông số chỉ công bố khi đã được xác nhận." breadcrumbs={[{ label: 'Nhôm dân dụng', href: '/nhom-dan-dung' }, { label: 'Dự án' }]} /><section className="home-section"><div className="container project-card-grid"><Link className="project-card" href="/du-an"><span><Image src="/images/v4/hero-house.webp" alt="Ứng dụng nhôm EUROHOUSE tại công trình nhà ở" fill unoptimized sizes="(max-width: 760px) 100vw, 50vw" /></span><div><h2>Ứng dụng nhà ở</h2><p>Tham khảo cách tổ chức cửa đi, cửa sổ và vách kính trong kiến trúc nhà ở.</p><b>Xem thư viện dự án <ArrowRight size={16} aria-hidden="true" /></b></div></Link></div></section><ConsultationCta title="Đang chuẩn bị một dự án dân dụng?" /></> }
