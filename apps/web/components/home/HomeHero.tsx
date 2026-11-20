import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';
import { homeIndustrialServices, homeMainSystems, homeSpecialistSystems } from '@/lib/homepage-systems';

export function HomeHero() {
  const { hero } = homepageCopy;
  const facts = [
    { value: String(homeMainSystems.length), label: 'dòng nhôm dân dụng' },
    { value: String(homeSpecialistSystems.length), label: 'hệ chuyên dụng' },
    { value: String(homeIndustrialServices.length), label: 'dịch vụ nhôm công nghiệp' },
  ];

  return (
    <section className="hp-hero" id="top" data-home-chapter="hero" aria-labelledby="home-hero-title">
      <picture className="hp-hero-media">
        <source media="(max-width: 760px)" srcSet="/images/v5/hero-ecento-70-mobile.webp" />
        <img
          src="/images/v5/hero-ecento-70.webp"
          alt="Mặt cắt profile ECENTO 70 đặt trước một ngôi nhà mái ngói hoàn thiện"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className="hp-hero-scrim" aria-hidden="true" />
      <div className="container hp-hero-inner">
        <div className="hp-hero-copy">
          <p className="hp-kicker hp-kicker-light">{hero.eyebrow}</p>
          <h1 id="home-hero-title">{hero.title}</h1>
          <p className="hp-hero-lead">{hero.lead}</p>
          <div className="hp-hero-actions">
            <Link className="hp-button hp-button-primary" href="#he-nhom">{hero.primaryAction} <ArrowDown size={18} aria-hidden="true" /></Link>
            <Link className="hp-button hp-button-light" href="/yeu-cau-bao-gia-cong-nghiep">{hero.secondaryAction} <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
        <dl className="hp-hero-facts" aria-label="EUROHOUSE trong con số">
          {facts.map((fact) => <div key={fact.label}><dt>{fact.value}</dt><dd>{fact.label}</dd></div>)}
        </dl>
      </div>
    </section>
  );
}
