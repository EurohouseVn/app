import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

export function ConversionPanel() {
  return (
    <section className="hp-cta" id="consultation" data-home-chapter="conversion" aria-labelledby="conversion-heading">
      <div className="container hp-cta-layout" data-reveal-group>
        <div data-reveal-item>
          <h2 id="conversion-heading">{homepageCopy.conversion.title}</h2>
          <p>{homepageCopy.conversion.support}</p>
        </div>
        <div className="hp-cta-actions" data-reveal-item>
          <Link className="hp-cta-light" href="/lien-he">
            <span><strong>Tư vấn hệ cửa cho công trình</strong><small>{homepageCopy.conversion.residential}</small></span>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
          <Link className="hp-cta-dark" href="/yeu-cau-bao-gia-cong-nghiep">
            <span><strong>Gửi bản vẽ sản xuất</strong><small>{homepageCopy.conversion.industrial}</small></span>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
