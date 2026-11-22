import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Mail, Phone, Trash2 } from 'lucide-react';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Hỗ trợ người dùng', alternates: { canonical: '/support' } };

export default function SupportPage() {
  return <><section className="page-hero compact-hero"><div className="container"><p className="kicker">Trung tâm hỗ trợ</p><h1>Hỗ trợ EUROHOUSE Workshop</h1><p>Thông tin liên hệ chính thức cho tài khoản, đơn hàng và dữ liệu ứng dụng.</p></div></section><section className="section page-section"><div className="container support-grid"><a href={site.phoneHref}><Phone size={24} /><strong>Gọi hỗ trợ</strong><span>{site.phone}</span></a><a href={`mailto:${site.email}`}><Mail size={24} /><strong>Gửi email</strong><span>{site.email}</span></a><Link href="/catalog"><BookOpen size={24} /><strong>Tài liệu sản phẩm</strong><span>Catalog và dữ liệu kỹ thuật</span></Link><Link href="/delete-account"><Trash2 size={24} /><strong>Xóa tài khoản</strong><span>Gửi yêu cầu và theo dõi xử lý</span></Link></div></section></>;
}
