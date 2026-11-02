import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

const families = [
  {
    id: 'residential',
    eyebrow: homepageCopy.residential.eyebrow,
    title: homepageCopy.residential.title,
    description: homepageCopy.residential.description,
    href: '/nhom-dan-dung',
    action: homepageCopy.residential.action,
    image: '/images/v5/project-villa.webp',
    alt: 'Công trình sử dụng giải pháp nhôm dân dụng EUROHOUSE',
  },
  {
    id: 'industrial',
    eyebrow: homepageCopy.industrial.eyebrow,
    title: homepageCopy.industrial.title,
    description: homepageCopy.industrial.description,
    href: '/nhom-cong-nghiep',
    action: homepageCopy.industrial.action,
    image: '/images/v5/factory-coating.webp',
    alt: 'Dây chuyền phục vụ sản phẩm nhôm công nghiệp EUROHOUSE',
  },
] as const;

export function ProductFamilyChooser() {
  return (
    <section className="home-section family-chooser" id="families" data-home-chapter="families" aria-labelledby="family-heading">
      <div className="container family-chooser-layout" data-reveal-group>
        <header className="family-manifesto" data-reveal-item>
          <p className="home-eyebrow">{homepageCopy.manifesto.eyebrow}</p>
          <h2 id="family-heading">{homepageCopy.manifesto.title}</h2>
          <p>{homepageCopy.manifesto.support}</p>
        </header>
        <div className="family-grid">
          {families.map((family, index) => (
            <Link className={`family-card family-card-${family.id}`} href={family.href} key={family.id} data-reveal-item>
              <Image src={family.image} alt={family.alt} fill unoptimized sizes="(max-width: 760px) 100vw, 50vw" />
              <span className="family-card-shade" />
              <span className="family-card-content">
                <small>{String(index + 1).padStart(2, '0')} · {family.eyebrow}</small>
                <strong>{family.title}</strong>
                <span>{family.description}</span>
                <b>{family.action} <ArrowRight size={17} aria-hidden="true" /></b>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
