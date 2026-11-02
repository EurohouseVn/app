import Image from 'next/image';
import { Boxes, ClipboardCheck, Factory, PencilRuler } from 'lucide-react';
import { homepageCopy } from '@/lib/homepage-presentation';

const capabilities = [
  { Icon: Factory, ...homepageCopy.capabilities[0] },
  { Icon: ClipboardCheck, ...homepageCopy.capabilities[1] },
  { Icon: PencilRuler, ...homepageCopy.capabilities[2] },
  { Icon: Boxes, ...homepageCopy.capabilities[3] },
] as const;

export function CapabilityStrip() {
  return (
    <section className="home-section capability-proof" data-home-chapter="proof" aria-labelledby="capability-proof-heading">
      <div className="container capability-proof-layout" data-reveal-group>
        <div className="capability-proof-copy" data-reveal-item>
          <p className="home-eyebrow">Bằng chứng tạo nên niềm tin</p>
          <h2 id="capability-proof-heading">Không chỉ nói về chất lượng. Cho thấy cách chất lượng được tạo ra.</h2>
          <div className="capability-proof-grid">
            {capabilities.map(({ Icon, title, text }, index) => <article key={title} data-reveal-item><span><Icon size={21} aria-hidden="true" /></span><small>{String(index + 1).padStart(2, '0')}</small><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </div>
        <figure className="capability-proof-media" data-reveal-item>
          <Image src="/images/v5/factory-coating.webp" alt="Dây chuyền hoàn thiện bề mặt profile nhôm EUROHOUSE" fill unoptimized sizes="(max-width: 860px) 100vw, 42vw" />
          <figcaption>Dây chuyền hoàn thiện bề mặt EUROHOUSE</figcaption>
        </figure>
      </div>
    </section>
  );
}
