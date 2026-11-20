import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homeSpecialistSystems } from '@/lib/homepage-systems';

export function SpecialistSystems() {
  return (
    <section className="hp-section hp-specialist" id="he-chuyen-dung" data-home-chapter="specialist" aria-labelledby="specialist-heading">
      <div className="container" data-reveal-group>
        <header className="hp-heading" data-reveal-item>
          <div>
            <p className="hp-kicker">Hệ chuyên dụng</p>
            <h2 id="specialist-heading">Sáu hệ cho bài toán riêng</h2>
          </div>
          <p>Khi công trình cần đại sảnh cao, cửa trượt panorama, mặt dựng kính hay nội thất cánh kính, các hệ chuyên dụng đi cùng bản vẽ mặt cắt và dải mã riêng.</p>
        </header>

        <ul className="hp-specialist-list">
          {homeSpecialistSystems.map((system) => (
            <li key={system.slug} data-reveal-item>
              <Link href={system.href} className="hp-specialist-item">
                <span className="hp-specialist-drawing">
                  <Image src={system.profile.image} alt={`Bản vẽ mặt cắt ${system.profile.code} — ${system.profile.name}`} width={400} height={340} unoptimized />
                </span>
                <span className="hp-specialist-copy">
                  <strong>{system.name}</strong>
                  <em>{system.tagline}</em>
                  <span>{system.summary}</span>
                  <span className="hp-specialist-features">{system.features.join(' · ')}</span>
                  <span className="hp-specialist-spec">
                    {system.profile.code} · {system.profile.thicknessMm} mm · {system.profile.kgPerMeter} kg/m · {system.catalog.profileCount} mã
                  </span>
                  <span className="hp-specialist-apps">Dùng cho: {system.applications.join(', ')}</span>
                </span>
                <span className="hp-arrow" aria-hidden="true"><ArrowRight size={20} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
