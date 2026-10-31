import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Box, Cpu, Factory, PanelTop, Settings, Sun } from 'lucide-react';
import type { HomepageContent } from '@/lib/homepage-content';

const residentialFallback = [
  { title: 'ECENTO 70', summary: 'Hệ nhôm đa khoang dành cho không gian cần nâng cao cách âm và cách nhiệt.', image: '/images/v5/product-ecento-70.webp', href: '/nhom-dan-dung/dong-san-pham/ecento-70' },
  { title: 'ECENTO PLUS', summary: 'Giải pháp rãnh K Châu Âu với thiết kế phẳng và cấu hình giấu vít.', image: '/images/v5/product-ecento-plus.webp', href: '/nhom-dan-dung/dong-san-pham/ecento-plus' },
  { title: 'HỆ 55 VÁT CẠNH', summary: 'Hệ nhôm kiến trúc cân bằng giữa thẩm mỹ, công năng và khả năng ứng dụng.', image: '/images/v5/product-he-55.webp', href: '/nhom-dan-dung/dong-san-pham/he-55-vat-canh' },
] as const;

const industrialServices = [
  { Icon: PanelTop, title: 'Định hình theo bản vẽ', href: '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve' },
  { Icon: Cpu, title: 'Chi tiết máy', href: '/nhom-cong-nghiep/chi-tiet-may' },
  { Icon: Sun, title: 'Nhôm năng lượng mặt trời', href: '/nhom-cong-nghiep/nang-luong-mat-troi' },
  { Icon: Factory, title: 'Đùn thuê', href: '/nhom-cong-nghiep/dun-thue' },
  { Icon: Settings, title: 'Gia công nhôm', href: '/nhom-cong-nghiep/gia-cong' },
  { Icon: Box, title: 'Gửi bản vẽ kỹ thuật', href: '/yeu-cau-bao-gia-cong-nghiep' },
] as const;

export function FeaturedSystems({ content }: { content: HomepageContent }) {
  const residential = content.residential.length > 0
    ? content.residential.slice(0, 3).map((item) => ({ title: item.title, summary: item.summary, image: item.image?.url, href: `/nhom-dan-dung/dong-san-pham/${item.slug}` }))
    : residentialFallback;

  return (
    <>
      <section className="home-section featured-residential" id="residential-systems" aria-labelledby="residential-heading">
        <div className="container">
          <header className="home-section-heading home-section-heading-split">
            <div><p className="home-eyebrow">Nhôm dân dụng</p><h2 id="residential-heading">Hệ nhôm cho từng ngôn ngữ kiến trúc.</h2></div>
            <Link className="home-text-link" href="/nhom-dan-dung">Xem toàn bộ hệ dân dụng <ArrowRight size={16} aria-hidden="true" /></Link>
          </header>
          <div className="system-card-grid">
            {residential.map((item) => (
              <Link className="system-card" href={item.href} key={item.title}>
                <span className="system-card-media">{item.image ? <Image src={item.image} alt={`${item.title} EUROHOUSE`} fill unoptimized sizes="(max-width: 760px) 100vw, 33vw" /> : null}</span>
                <span className="system-card-copy"><strong>{item.title}</strong><span>{item.summary}</span><b>Tìm hiểu hệ nhôm <ArrowRight size={16} aria-hidden="true" /></b></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section industrial-offerings" id="industrial-services" aria-labelledby="industrial-heading">
        <div className="container industrial-layout">
          <div className="industrial-intro"><p className="home-eyebrow">Nhôm công nghiệp</p><h2 id="industrial-heading">Từ profile kỹ thuật đến chi tiết hoàn thiện.</h2><p>Tra cứu theo nhu cầu ứng dụng hoặc gửi hồ sơ để EUROHOUSE đánh giá khả năng triển khai.</p><Link className="home-button home-button-primary" href="/yeu-cau-bao-gia-cong-nghiep">Gửi bản vẽ <ArrowRight size={17} aria-hidden="true" /></Link></div>
          <div className="industrial-service-grid">
            {industrialServices.map(({ Icon, title, href }) => <Link href={href} key={title}><Icon size={22} aria-hidden="true" /><strong>{title}</strong><ArrowRight size={16} aria-hidden="true" /></Link>)}
          </div>
        </div>
      </section>
    </>
  );
}
