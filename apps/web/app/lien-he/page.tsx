import type { Metadata } from 'next';
import { Mail, MapPin, Phone } from 'lucide-react';
import { ContactForm } from '@/components/ContactForm';
import { site } from '@/lib/site';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Liên hệ Eurohouse Việt Nam', description: 'Liên hệ EUROHOUSE để được tư vấn hệ nhôm kiến trúc, catalog, profile công nghiệp theo bản vẽ, đùn thuê, gia công hoặc hợp tác phân phối.', canonicalPath: '/lien-he', image: '/images/v4/factory-coating-line.jpg', imageAlt: 'Liên hệ tư vấn sản phẩm và dịch vụ nhôm Eurohouse' });

export default function ContactPage() {
  return (
    <>
      <section className="page-hero compact-hero"><div className="container"><p className="kicker">Liên hệ</p><h1>Kết nối đúng bộ phận Eurohouse.</h1><p>Sản phẩm, kỹ thuật, đại lý hoặc hỗ trợ nền tảng đều bắt đầu từ một yêu cầu rõ ràng.</p></div></section>
      <section className="section page-section"><div className="container contact-layout"><div className="contact-info"><p className="kicker">Thông tin chung</p><h2>Nhà máy và mạng lưới phân phối.</h2><div className="contact-method"><Phone size={20} /><div><small>Điện thoại</small><a href={site.phoneHref}>{site.phone}</a></div></div><div className="contact-method"><Mail size={20} /><div><small>Email</small><a href={`mailto:${site.email}`}>{site.email}</a></div></div><div className="contact-method"><MapPin size={20} /><div><small>Nhà máy</small><p>{site.address}</p></div></div></div><ContactForm /></div></section>
    </>
  );
}
