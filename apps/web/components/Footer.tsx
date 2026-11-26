import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { companyRoutes, familyRoutes, globalNavigationRoutes, stablePublicRoutes } from '@/lib/public-routes';
import { site } from '@/lib/site';
import { brandAssets } from '@/lib/homepage-presentation';

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
            <Image src={brandAssets.logo} alt={brandAssets.logoAlt} width={220} height={83} />
          </Link>
          <h2>Nhôm hệ cao cấp cho kiến trúc. Giải pháp nhôm định hình đáng tin cậy cho công nghiệp.</h2>
          <p>Sản phẩm, năng lực, tài liệu kỹ thuật và hệ sinh thái số chính thức tại nhomeurohouse.com.</p>
        </div>

        <div className="footer-column">
          <h3>Sản phẩm</h3>
          <div className="footer-links">{familyRoutes.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}</div>
        </div>

        <div className="footer-column">
          <h3>EUROHOUSE</h3>
          <div className="footer-links">{companyNavigation.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}<Link href="/he-sinh-thai">Hệ sinh thái số</Link><Link href="/#tai-ung-dung">Tải ứng dụng</Link></div>
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

      <div className="container">
        <p className="footer-slogan">Nhôm của sự thịnh vượng</p>
      </div>

      <div className="container footer-bottom">
        <p>© {new Date().getFullYear()} EUROHOUSE. Pháp nhân phát hành: {site.legalName}.</p>
        <div>{stablePublicRoutes.map((item) => <Link key={item.id} href={item.href}>{item.label}</Link>)}</div>
      </div>
    </footer>
  );
}
