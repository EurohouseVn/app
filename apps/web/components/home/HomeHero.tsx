import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';

export function HomeHero() {
  return (
    <section className="home-hero" id="top">
      <picture>
        <source media="(max-width: 600px)" srcSet="/images/v5/hero-ecento-70-mobile.webp" />
        <Image className="home-hero-image" src="/images/v5/hero-ecento-70.webp" alt="Giải pháp nhôm kiến trúc EUROHOUSE trên công trình nhà ở" fill priority unoptimized sizes="100vw" />
      </picture>
      <div className="home-hero-overlay" />
      <div className="container home-hero-inner">
        <p className="home-eyebrow">EUROHOUSE · NHÔM KIẾN TRÚC &amp; CÔNG NGHIỆP</p>
        <h1>Một nền tảng nhôm.<br />Hai năng lực chuyên sâu.</h1>
        <p className="home-hero-lead">Giải pháp nhôm dân dụng cho công trình và nhôm công nghiệp theo yêu cầu kỹ thuật — được kết nối trên cùng một hệ sinh thái EUROHOUSE.</p>
        <div className="home-hero-actions">
          <Link className="home-button home-button-primary" href="#families">Chọn nhóm sản phẩm <ArrowDown size={17} aria-hidden="true" /></Link>
          <Link className="home-button home-button-quiet" href="/tai-nguyen/catalog">Xem catalog kỹ thuật <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
