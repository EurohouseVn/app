import type { Metadata } from 'next';
import Link from 'next/link';
import { AppDownload } from '@/components/AppDownload';
import { ArrowUpRight, Boxes, Building2, Factory, QrCode, Smartphone, Truck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Hệ sinh thái số Eurohouse',
  description: 'Kết nối nhà máy, nhà phân phối và xưởng sản xuất trên nền tảng Eurohouse.',
  alternates: { canonical: '/he-sinh-thai' },
};

const portals = [
  { icon: Smartphone, title: 'EUROHOUSE Workshop', audience: 'Xưởng nhôm kính', text: 'Báo giá, công trình, công thức cắt, đặt nhôm, kho và quản trị vận hành hằng ngày.', href: 'https://app.nhomeurohouse.com', action: 'Mở ứng dụng' },
  { icon: Truck, title: 'Cổng NPP', audience: 'Nhà phân phối khu vực', text: 'Tiếp nhận đơn xưởng, xác nhận cân thực tế, giao hàng, tồn kho và công nợ.', href: 'https://npp.nhomeurohouse.com', action: 'Đăng nhập NPP' },
  { icon: Factory, title: 'Eurohouse Admin', audience: 'Vận hành công ty', text: 'Quản lý catalog, kỹ thuật, đơn hàng, sản xuất, nội dung và mạng lưới phân phối.', href: 'https://admin.nhomeurohouse.com', action: 'Đăng nhập nội bộ' },
];

export default async function EcosystemPage() {
  return (
    <>
      <section className="page-hero compact-hero"><div className="container"><p className="kicker">Nền tảng vận hành</p><h1>Hệ sinh thái Eurohouse</h1><p>Một luồng dữ liệu xuyên suốt từ catalog kỹ thuật đến đơn giao và bảo hành công trình.</p></div></section>
      <section className="section page-section"><div className="container portal-grid">{portals.map(({ icon: Icon, ...portal }) => <article key={portal.title}><span><Icon size={26} /></span><small>{portal.audience}</small><h2>{portal.title}</h2><p>{portal.text}</p><a className="text-link" href={portal.href}>{portal.action}<ArrowUpRight size={16} /></a></article>)}</div></section>
      <section className="section systems-section"><div className="container"><div className="section-heading"><p className="kicker">Dữ liệu liên thông</p><h2>Không nhập lại cùng một thông tin ở nhiều nơi.</h2></div><div className="benefit-grid">{[
        { icon: Boxes, title: 'Catalog thống nhất', text: 'Mã thanh, hệ, màu và tỷ trọng cùng một nguồn dữ liệu.' },
        { icon: Building2, title: 'Theo công trình', text: 'Báo giá, bóc tách, đặt hàng và thu chi liên kết với công trình.' },
        { icon: QrCode, title: 'Truy xuất bảo hành', text: 'QR kết nối sản phẩm, đơn hàng và hồ sơ sau bàn giao.' },
      ].map(({ icon: Icon, title, text }) => <article key={title}><Icon size={24} /><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>
      <section className="section narrow-cta"><div className="container"><h2>Cần kích hoạt tài khoản cho xưởng hoặc NPP?</h2><Link className="button button-primary" href="/lien-he">Gửi thông tin đăng ký</Link></div></section>
      <AppDownload />
    </>
  );
}
