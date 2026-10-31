import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, LogIn, ShieldCheck } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';

export const metadata: Metadata = { title: 'Nhà phân phối EUROHOUSE', description: 'Thông tin hợp tác và lối vào Cổng Nhà phân phối EUROHOUSE.', alternates: { canonical: '/nha-phan-phoi' } };
export default function DistributorPage() { return <><PageIntro eyebrow="HỆ SINH THÁI NHÀ PHÂN PHỐI" title="Một lối công khai, một cổng vận hành riêng." summary="Website giới thiệu quy trình hợp tác. Giá, công nợ, đơn hàng và tài liệu riêng chỉ có trong Cổng NPP sau khi đăng nhập." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Nhà phân phối' }]} actions={<a className="home-button home-button-primary" href="https://npp.nhomeurohouse.com"><LogIn size={17} aria-hidden="true" /> Đăng nhập Cổng NPP</a>} />
    <section className="home-section distributor-paths"><div className="container"><Link href="/nha-phan-phoi/chinh-sach"><ShieldCheck size={25} aria-hidden="true" /><strong>Nguyên tắc hợp tác</strong><span>Nội dung công khai, không chứa giá hay dữ liệu riêng của tổ chức.</span><b>Xem thông tin <ArrowRight size={16} /></b></Link><Link href="/nha-phan-phoi/dang-ky"><BookOpen size={25} aria-hidden="true" /><strong>Đăng ký tìm hiểu</strong><span>Chuẩn bị thông tin doanh nghiệp và khu vực hoạt động.</span><b>Bắt đầu <ArrowRight size={16} /></b></Link></div></section>
  </>;
}
