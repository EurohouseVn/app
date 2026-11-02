import Link from 'next/link';
import { ArrowRight, FileUp, MessagesSquare } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

export function ConversionPanel() {
  return (
    <section className="home-section conversion-section" id="consultation" data-home-chapter="conversion" aria-labelledby="conversion-heading">
      <div className="container conversion-panel" data-reveal-group>
        <div data-reveal-item><p className="home-eyebrow">{homepageCopy.conversion.eyebrow}</p><h2 id="conversion-heading">{homepageCopy.conversion.title}</h2><p>{homepageCopy.conversion.support}</p></div>
        <div className="conversion-actions" data-reveal-item>
          <Link href="/lien-he"><MessagesSquare size={21} aria-hidden="true" /><span><strong>Tư vấn dân dụng &amp; dự án</strong><small>{homepageCopy.conversion.residential}</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/yeu-cau-bao-gia-cong-nghiep"><FileUp size={21} aria-hidden="true" /><span><strong>Gửi bản vẽ công nghiệp</strong><small>{homepageCopy.conversion.industrial}</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
