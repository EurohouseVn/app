import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageContent } from '@/lib/homepage-content';
import { homepageCopy } from '@/lib/homepage-presentation';

const fallback = [
  { title: 'Biệt thự hiện đại · Hệ cửa cao cấp', summary: 'Không gian mở với hệ cửa nhôm đồng bộ cho kiến trúc nhà ở.', image: '/images/v5/project-villa.webp', href: '/du-an' },
  { title: 'Không gian mở · Khẩu độ lớn', summary: 'Ứng dụng cửa và vách kính để kết nối ánh sáng với không gian sống.', image: '/images/v4/installed-window.jpg', href: '/du-an' },
  { title: 'Biên dạng theo ứng dụng', summary: 'Từ yêu cầu sử dụng đến profile và bề mặt hoàn thiện phù hợp.', image: '/images/v4/factory-coating-line.jpg', href: '/du-an' },
] as const;

export function FeaturedProjects({ content }: { content: HomepageContent }) {
  const projects = fallback.map((project, index) => {
    const item = content.projects[index];
    return item
      ? { title: item.title, summary: item.summary, image: item.image?.url ?? project.image, href: `/du-an/${item.slug}` }
      : project;
  });

  return (
    <section className="home-section projects-section" id="projects" data-home-chapter="projects" aria-labelledby="projects-heading">
      <div className="container" data-reveal-group>
        <header className="home-section-heading home-section-heading-split">
          <div data-reveal-item><p className="home-eyebrow">{homepageCopy.projects.eyebrow}</p><h2 id="projects-heading">{homepageCopy.projects.title}</h2><p>{homepageCopy.projects.support}</p></div>
          <Link className="home-text-link" href="/du-an" data-reveal-item>{homepageCopy.projects.action} <ArrowRight size={16} aria-hidden="true" /></Link>
        </header>
        <div className="project-card-grid">
          {projects.map((project, index) => <Link className={`project-card${index === 0 ? ' project-card-featured' : ''}`} href={project.href} key={project.title} data-reveal-item><span><Image src={project.image} alt={project.title} fill unoptimized sizes="(max-width: 760px) 100vw, 50vw" /></span><div><small>{index === 2 ? 'NHÔM CÔNG NGHIỆP' : 'NHÔM DÂN DỤNG'}</small><h3>{project.title}</h3><p>{project.summary}</p><b>Xem chi tiết <ArrowRight size={16} aria-hidden="true" /></b></div></Link>)}
        </div>
      </div>
    </section>
  );
}
