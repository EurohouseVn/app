import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { companyRoutes, familyRoutes, globalNavigationRoutes, stablePublicRoutes } from '@/lib/public-routes';
import { site } from '@/lib/site';

const companyNavigation = [
  ...globalNavigationRoutes.filter((route) => ['projects', 'capability', 'resources', 'distributors', 'contact'].includes(route.id)),
  ...companyRoutes.filter((route) => route.id === 'about'),
];
const nppRoute = globalNavigationRoutes.find((route) => route.id === 'npp-sign-in');

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link className="footer-brand-lockup" href="/" aria-label="EUROHOUSE — Trang chủ">
            <Image src="/brand/logo-mark.png" alt="" width={52} height={52} />
            <span aria-hidden="true"><strong><b>EURO</b><i>H</i>OUSE</strong><small>NHÔM CỦA SỰ THỊNH VƯỢNG</small></span>
          </Link>
          <h2>Giải pháp nhôm cho kiến trúc và công nghiệp Việt.</h2>
          <p>Thông tin sản phẩm, tài liệu kỹ thuật và hệ sinh thái số chính thức tại nhomeurohouse.com.</p>
        </div>

        <div className="footer-column">
          <h3>Sản phẩm</h3>
          <div className="footer-links">{familyRoutes.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}</div>
        </div>

        <div className="footer-column">
          <h3>EUROHOUSE</h3>
          <div className="footer-links">{companyNavigation.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}</div>
        </div>

        <div className="footer-column">
          <h3>Liên hệ &amp; NPP</h3>
          <div className="footer-contact">
            <a href={site.phoneHref}><Phone size={16} aria-hidden="true" />{site.phone}</a>
            <a href={`mailto:${site.email}`}><Mail size={16} aria-hidden="true" />{site.email}</a>
            <p><MapPin size={16} aria-hidden="true" />{site.address}</p>
            {nppRoute ? <a className="footer-portal" href={nppRoute.href}>Đăng nhập Cổng NPP <ArrowUpRight size={14} aria-hidden="true" /></a> : null}
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} EUROHOUSE. Pháp nhân phát hành: {site.legalName}.</p>
        <div>{stablePublicRoutes.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}</div>
      </div>
    </footer>
  );
}
