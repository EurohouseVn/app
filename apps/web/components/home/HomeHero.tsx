import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

export function HomeHero() {
  const { hero } = homepageCopy;

  return (
    <section className="home-hero" id="top" data-home-chapter="hero" aria-labelledby="home-hero-title">
      <Image
        className="home-hero-image"
        src="/images/v4/factory-yard.jpg"
        alt="Khu vực sản xuất và lưu chuyển profile nhôm tại EUROHOUSE"
        fill
        priority
        unoptimized
        sizes="100vw"
      />
      <div className="home-hero-overlay" />
      <div className="container home-hero-inner">
        <div className="home-hero-copy">
          <p className="home-eyebrow">{hero.eyebrow}</p>
          <h1 id="home-hero-title">{hero.title}</h1>
          <p className="home-hero-lead">{hero.lead}</p>
          <div className="home-hero-actions">
            <Link className="home-button home-button-primary" href="#families">{hero.primaryAction} <ArrowDown size={17} aria-hidden="true" /></Link>
            <Link className="home-button home-button-quiet" href="/nang-luc">{hero.secondaryAction} <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
        <dl className="home-hero-proofs" aria-label="Phạm vi đồng hành của EUROHOUSE">
          {hero.proofs.map((proof) => <div key={proof.value}><dt>{proof.value}</dt><dd>{proof.label}</dd></div>)}
        </dl>
      </div>
      <div className="home-hero-word" aria-hidden="true">EUROHOUSE</div>
      <p className="home-hero-signature">NHÔM HỆ CAO CẤP · NHÔM CÔNG NGHIỆP UY TÍN</p>
    </section>
  );
}
