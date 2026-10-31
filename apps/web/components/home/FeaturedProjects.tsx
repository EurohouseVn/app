import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageContent } from '@/lib/homepage-content';

const fallback = [
  { title: 'Nhà ở phong cách tân cổ điển', summary: 'Ứng dụng tham khảo cho cửa đi, cửa sổ và vách kính trong công trình nhà ở.', image: '/images/v5/project-villa.webp', href: '/du-an' },
  { title: 'Bề mặt vân gỗ trong kiến trúc', summary: 'Gợi ý phối hợp bề mặt nhôm với vật liệu và không gian kiến trúc.', image: '/images/v5/finish-wood.webp', href: '/du-an' },
] as const;

export function FeaturedProjects({ content }: { content: HomepageContent }) {
  const projects = content.projects.length > 0
    ? content.projects.slice(0, 2).map((item) => ({ title: item.title, summary: item.summary, image: item.image?.url, href: `/du-an/${item.slug}` }))
    : fallback;

  return (
    <section className="home-section projects-section" id="projects" aria-labelledby="projects-heading">
      <div className="container">
        <header className="home-section-heading home-section-heading-split">
          <div><p className="home-eyebrow">Ứng dụng &amp; dự án</p><h2 id="projects-heading">Vật liệu được nhìn thấy trong không gian thật.</h2></div>
          <Link className="home-text-link" href="/du-an">Xem thư viện dự án <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>
        <div className="project-card-grid">
          {projects.map((project) => <Link className="project-card" href={project.href} key={project.title}><span>{project.image ? <Image src={project.image} alt={project.title} fill unoptimized sizes="(max-width: 760px) 100vw, 50vw" /> : null}</span><div><h3>{project.title}</h3><p>{project.summary}</p><b>Xem chi tiết <ArrowRight size={16} aria-hidden="true" /></b></div></Link>)}
        </div>
      </div>
    </section>
  );
}
