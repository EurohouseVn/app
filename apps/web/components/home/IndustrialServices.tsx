import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';
import { homeIndustrialServices } from '@/lib/homepage-systems';

export function IndustrialServices() {
  return (
    <section className="hp-section hp-industry" id="industrial-services" data-home-chapter="industry" aria-labelledby="industrial-heading">
      <div className="container hp-industry-layout" data-reveal-group>
        <figure className="hp-industry-photo" data-reveal-item>
          <Image src="/images/v4/factory-yard.jpg" alt="Profile nhôm thành phẩm xếp tại sân nhà máy EUROHOUSE" fill unoptimized sizes="(max-width: 860px) 100vw, 46vw" />
        </figure>
        <div className="hp-industry-copy">
          <div data-reveal-item>
            <p className="hp-kicker">Nhôm công nghiệp</p>
            <h2 id="industrial-heading">{homepageCopy.industrial.sectionTitle.replace(/\.$/, '')}</h2>
            <p className="hp-lead">{homepageCopy.industrial.support}</p>
          </div>
          <ul className="hp-service-list">
            {homeIndustrialServices.map((service) => (
              <li key={service.href} data-reveal-item>
                <Link href={service.href}>
                  <span><strong>{service.title}</strong><span>{service.text}</span></span>
                  <ArrowRight size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="hp-row-actions" data-reveal-item>
            <Link className="hp-button hp-button-primary" href="/yeu-cau-bao-gia-cong-nghiep">Gửi yêu cầu kỹ thuật <ArrowRight size={18} aria-hidden="true" /></Link>
            <Link className="hp-button hp-button-quiet" href="/nang-luc">Hồ sơ năng lực</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
