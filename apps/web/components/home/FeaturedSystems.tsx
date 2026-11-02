import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Cpu, Factory, PanelTop, Settings, Sun } from 'lucide-react';
import type { HomepageContent } from '@/lib/homepage-content';
import { mergeResidentialSystems } from '@/lib/homepage-card-selection';
import { homepageCopy, residentialFallbackSystems } from '@/lib/homepage-presentation';

const industrialIcons = [PanelTop, Cpu, Sun, Factory, Settings] as const;

export function FeaturedSystems({ content }: { content: HomepageContent }) {
  const residential = mergeResidentialSystems(content.residential, residentialFallbackSystems);

  return (
    <>
      <section className="home-section featured-residential" id="residential-systems" data-home-chapter="systems" aria-labelledby="residential-heading">
        <div className="container" data-reveal-group>
          <header className="home-section-heading home-section-heading-split">
            <div data-reveal-item><p className="home-eyebrow">Nhôm dân dụng</p><h2 id="residential-heading">{homepageCopy.residential.sectionTitle}</h2></div>
            <Link className="home-text-link" href="/nhom-dan-dung" data-reveal-item>Xem toàn bộ hệ dân dụng <ArrowRight size={16} aria-hidden="true" /></Link>
          </header>
          <div className="system-card-grid">
            {residential.map((item, index) => (
              <Link className={`system-card${index === 0 ? ' system-card-featured' : ''}`} href={item.href} key={item.title} data-reveal-item>
                <span className={`system-card-media${item.image ? '' : ' system-card-media-empty'}`}>
                  {item.image
                    ? <Image src={item.image} alt={`${item.title} EUROHOUSE`} fill unoptimized sizes="(max-width: 760px) 100vw, 33vw" />
                    : <span className="home-media-placeholder" aria-hidden="true">EUROHOUSE</span>}
                </span>
                <span className="system-card-copy"><small>{String(index + 1).padStart(2, '0')} · HỆ NHÔM KIẾN TRÚC</small><strong>{item.title}</strong><span>{item.summary}</span><b>Tìm hiểu hệ nhôm <ArrowRight size={16} aria-hidden="true" /></b></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-section industrial-offerings" id="industrial-services" data-home-chapter="industry" aria-labelledby="industrial-heading">
        <div className="container industrial-layout" data-reveal-group>
          <div className="industrial-visual" data-reveal-item>
            <Image src="/images/v4/aluminum-billets.jpg" alt="Phôi nhôm phục vụ sản xuất profile công nghiệp EUROHOUSE" fill unoptimized sizes="(max-width: 860px) 100vw, 48vw" />
            <span>ĐÙN ÉP · XỬ LÝ BỀ MẶT · GIA CÔNG</span>
          </div>
          <div className="industrial-content" data-reveal-item>
            <div className="industrial-intro"><p className="home-eyebrow">Nhôm công nghiệp</p><h2 id="industrial-heading">{homepageCopy.industrial.sectionTitle}</h2><p>{homepageCopy.industrial.support}</p></div>
            <div className="industrial-service-grid">
              {homepageCopy.industrial.services.map((service, index) => {
                const Icon = industrialIcons[index];
                return <Link href={service.href} key={service.href} data-reveal-item><Icon size={21} aria-hidden="true" /><span><small>{service.number} · {service.label}</small><strong>{service.title}</strong></span><ArrowRight size={16} aria-hidden="true" /></Link>;
              })}
            </div>
            <div className="industrial-actions" data-reveal-item>
              <Link className="home-button home-button-primary" href="/yeu-cau-bao-gia-cong-nghiep">Gửi yêu cầu kỹ thuật <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="home-button home-button-quiet" href="/nang-luc">Xem hồ sơ năng lực</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
