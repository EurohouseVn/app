import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Building2, Factory } from 'lucide-react';

const families = [
  {
    id: 'residential',
    eyebrow: 'Công trình · Nhà ở · Dự án',
    title: 'NHÔM DÂN DỤNG',
    description: 'Khám phá hệ cửa, hệ chuyên dụng, giải pháp kiến trúc và tài liệu dành cho nhà ở, biệt thự và dự án.',
    href: '/nhom-dan-dung',
    action: 'Khám phá hệ nhôm',
    image: '/images/v5/project-villa.webp',
    alt: 'Công trình sử dụng giải pháp nhôm dân dụng EUROHOUSE',
    Icon: Building2,
  },
  {
    id: 'industrial',
    eyebrow: 'Bản vẽ · Profile · Gia công',
    title: 'NHÔM CÔNG NGHIỆP',
    description: 'Tìm giải pháp định hình theo bản vẽ, chi tiết máy, nhôm năng lượng mặt trời, đùn thuê và gia công.',
    href: '/nhom-cong-nghiep',
    action: 'Xem năng lực công nghiệp',
    image: '/images/v5/factory-coating.webp',
    alt: 'Dây chuyền phục vụ sản phẩm nhôm công nghiệp EUROHOUSE',
    Icon: Factory,
  },
] as const;

export function ProductFamilyChooser() {
  return (
    <section className="home-section family-chooser" id="families" aria-labelledby="family-heading">
      <div className="container">
        <header className="home-section-heading home-section-heading-split">
          <div><p className="home-eyebrow">Bắt đầu từ nhu cầu của bạn</p><h2 id="family-heading">Chọn đúng nhóm sản phẩm.</h2></div>
          <p>Hai nhóm được tổ chức độc lập về nội dung kỹ thuật, tài liệu và hành trình tư vấn.</p>
        </header>
        <div className="family-grid">
          {families.map(({ Icon, ...family }) => (
            <Link className={`family-card family-card-${family.id}`} href={family.href} key={family.id}>
              <Image src={family.image} alt={family.alt} fill unoptimized sizes="(max-width: 760px) 100vw, 50vw" />
              <span className="family-card-shade" />
              <span className="family-card-content">
                <Icon size={25} aria-hidden="true" />
                <small>{family.eyebrow}</small>
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
