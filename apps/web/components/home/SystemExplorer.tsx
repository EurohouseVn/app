'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Check, FileText } from 'lucide-react';
import { useRef, useState, type KeyboardEvent } from 'react';
import { homeMainSystems } from '@/lib/homepage-systems';

const swatches: Record<string, string> = {
  'Cafe Metallic': '#5b4636',
  'Xám ngọc trai': '#8e949b',
  'Vân gỗ Cẩm Lai': '#8a4a2b',
  'Vân gỗ Olack': '#5a3926',
  Cafe: '#4a3a2f',
  'Xám ghi': '#7b8086',
  'Trắng': '#f2f2ef',
};

// Catalog EUROHOUSE ghi số thập phân bằng dấu chấm (1.6 mm, 1.385 kg/m); giữ nguyên cách ghi đó.
function formatMm(value: number) {
  return value.toFixed(1);
}

function formatKg(value: number) {
  return String(value);
}

export function SystemExplorer() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = homeMainSystems.length - 1;
    const next = event.key === 'ArrowRight' ? (active === last ? 0 : active + 1)
      : event.key === 'ArrowLeft' ? (active === 0 ? last : active - 1)
        : event.key === 'Home' ? 0
          : event.key === 'End' ? last
            : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section className="hp-section hp-systems" id="he-nhom" data-home-chapter="systems" aria-labelledby="systems-heading">
      <div className="container" data-reveal-group>
        <header className="hp-heading" data-reveal-item>
          <div>
            <p className="hp-kicker">Nhôm dân dụng</p>
            <h2 id="systems-heading">Chọn hệ, xem mặt cắt</h2>
          </div>
          <p>Bốn dòng nhôm kiến trúc, mỗi dòng có dải mã riêng trong catalog. Chọn một hệ để xem khung tiêu biểu, độ dày, trọng lượng và nơi hệ đó phát huy tốt nhất.</p>
        </header>

        <div className="hp-tabs" role="tablist" aria-label="Các dòng nhôm dân dụng" data-reveal-item>
          {homeMainSystems.map((system, index) => (
            <button
              key={system.slug}
              ref={(node) => { tabRefs.current[index] = node; }}
              type="button"
              role="tab"
              id={`system-tab-${system.slug}`}
              aria-selected={active === index}
              aria-controls={`system-panel-${system.slug}`}
              tabIndex={active === index ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={onKeyDown}
            >
              <strong>{system.name}</strong>
              <span>{system.bestFor}</span>
            </button>
          ))}
        </div>

        {homeMainSystems.map((system, index) => (
          <div
            key={system.slug}
            className="hp-system-panel"
            role="tabpanel"
            id={`system-panel-${system.slug}`}
            aria-labelledby={`system-tab-${system.slug}`}
            hidden={active !== index}
          >
            <figure className={`hp-system-photo hp-system-photo-${system.imageFit}`}>
              <Image src={system.image} alt={system.imageAlt} fill unoptimized sizes="(max-width: 860px) 100vw, 44vw" />
              <figcaption>{system.name} · {system.tagline}</figcaption>
            </figure>

            <div className="hp-system-body">
              <div className="hp-profile">
                <div className="hp-profile-drawing">
                  <Image src={system.profile.image} alt={`Bản vẽ mặt cắt ${system.profile.code} — ${system.profile.name}`} width={400} height={340} unoptimized />
                </div>
                <dl className="hp-spec">
                  <div><dt>Khung tiêu biểu</dt><dd>{system.profile.code}</dd></div>
                  <div><dt>Độ dày</dt><dd>{system.profile.thicknessMm} mm</dd></div>
                  <div><dt>Trọng lượng</dt><dd>{formatKg(system.profile.kgPerMeter)} kg/m</dd></div>
                  <div><dt>Trong catalog</dt><dd>{system.catalog.profileCount} mã</dd></div>
                </dl>
              </div>

              <h3>{system.name}</h3>
              <p className="hp-system-description">{system.description}</p>

              <div className="hp-system-lists">
                <div>
                  <h4>Phù hợp cho</h4>
                  <ul>{system.suitableFor.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
                </div>
                <div>
                  <h4>Điểm mạnh</h4>
                  <ul>{system.benefits.map((item) => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
                </div>
              </div>

              <div className="hp-system-meta">
                <div>
                  <h4>Đặc điểm</h4>
                  <p>{system.features.join(' · ')}</p>
                </div>
                <div>
                  <h4>Màu bề mặt</h4>
                  <ul className="hp-swatches">
                    {system.colors.map((color) => <li key={color}><span style={{ background: swatches[color] ?? '#9aa1a8' }} aria-hidden="true" />{color}</li>)}
                  </ul>
                </div>
                <div>
                  <h4>Bảo hành</h4>
                  <p>{system.warranty}</p>
                </div>
              </div>

              <div className="hp-system-actions">
                <Link className="hp-button hp-button-primary" href={system.href}>Xem chi tiết {system.name} <ArrowRight size={18} aria-hidden="true" /></Link>
                <Link className="hp-button hp-button-quiet" href="/tai-nguyen/catalog"><FileText size={18} aria-hidden="true" /> Tải catalog</Link>
              </div>
            </div>
          </div>
        ))}

        <div className="hp-compare" data-reveal-item>
          <h3>So sánh nhanh bốn dòng</h3>
          <div className="hp-compare-scroll">
            <table>
              <caption className="hp-sr-only">So sánh ECENTO 70, ECENTO PLUS, Hệ 55 vát cạnh và PRECO theo catalog r19</caption>
              <thead>
                <tr><th scope="col">Dòng nhôm</th><th scope="col">Thế mạnh</th><th scope="col">Khung tiêu biểu</th><th scope="col">Dải độ dày</th><th scope="col">Số mã</th><th scope="col">Bảo hành</th></tr>
              </thead>
              <tbody>
                {homeMainSystems.map((system) => (
                  <tr key={system.slug}>
                    <th scope="row"><Link href={system.href}>{system.name}</Link></th>
                    <td>{system.tagline}</td>
                    <td>{system.profile.code} · {system.profile.thicknessMm} mm</td>
                    <td>{formatMm(system.catalog.thicknessMin)}–{formatMm(system.catalog.thicknessMax)} mm</td>
                    <td>{system.catalog.profileCount}</td>
                    <td>{system.warranty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Link className="hp-text-link" href="/nhom-dan-dung/so-sanh">So sánh chi tiết các hệ <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
