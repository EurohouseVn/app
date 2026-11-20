import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

const families = [
  {
    id: 'residential',
    title: homepageCopy.residential.title,
    description: 'Cửa đi, cửa sổ, vách kính, mặt dựng cho nhà ở, biệt thự và công trình. Có catalog và mặt cắt để chủ nhà, kiến trúc sư và thợ cùng trao đổi.',
    href: '/nhom-dan-dung',
    action: homepageCopy.residential.action,
    image: '/images/v5/project-villa.webp',
    alt: 'Biệt thự hiện đại sử dụng hệ cửa nhôm EUROHOUSE',
  },
  {
    id: 'industrial',
    title: homepageCopy.industrial.title,
    description: 'Profile theo bản vẽ, chi tiết máy, khung pin mặt trời, đùn thuê và gia công cho doanh nghiệp sản xuất.',
    href: '/nhom-cong-nghiep',
    action: homepageCopy.industrial.action,
    image: '/images/v4/factory-coating-line.jpg',
    alt: 'Dây chuyền sơn profile nhôm công nghiệp tại nhà máy EUROHOUSE',
  },
] as const;

export function ProductFamilyChooser() {
  return (
    <section className="hp-families" id="families" data-home-chapter="families" aria-label="Hai lĩnh vực sản phẩm">
      <div className="container hp-family-grid" data-reveal-group>
        {families.map((family) => (
          <Link className="hp-family-card" href={family.href} key={family.id} data-reveal-item>
            <span className="hp-family-media"><Image src={family.image} alt={family.alt} fill unoptimized sizes="(max-width: 760px) 34vw, 240px" /></span>
            <span className="hp-family-copy">
              <strong>{family.title}</strong>
              <span>{family.description}</span>
              <small>{family.action}</small>
            </span>
            <span className="hp-arrow" aria-hidden="true"><ArrowRight size={20} /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}
