import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { homeProcessSteps } from '@/lib/homepage-systems';

export function CapabilityStrip() {
  return (
    <section className="hp-section hp-process" id="nang-luc" data-home-chapter="proof" aria-labelledby="process-heading">
      <div className="container" data-reveal-group>
        <header className="hp-heading" data-reveal-item>
          <div>
            <p className="hp-kicker">Năng lực sản xuất</p>
            <h2 id="process-heading">Một nhà máy, trọn quy trình</h2>
          </div>
          <p>Profile EUROHOUSE đi từ phôi nhôm, qua đùn ép và hoàn thiện bề mặt, đến tay thợ cùng mẫu màu và catalog. <Link className="hp-text-link" href="/nang-luc">Xem năng lực <ArrowRight size={16} aria-hidden="true" /></Link></p>
        </header>
        <ol className="hp-process-list">
          {homeProcessSteps.map((step) => (
            <li key={step.title} data-reveal-item>
              <span className="hp-process-photo"><Image src={step.image} alt={step.alt} fill unoptimized sizes="(max-width: 760px) 80vw, 25vw" /></span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
