import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { HomepageContent } from '@/lib/homepage-content';
import { homepageFamilyLabel, mergeHomepageProjects } from '@/lib/homepage-card-selection';
import { homepageCopy } from '@/lib/homepage-presentation';

const fallback = [
  { slug: 'biet-thu-hien-dai', title: 'Biệt thự hiện đại · Hệ cửa cao cấp', summary: 'Không gian mở với hệ cửa nhôm đồng bộ cho kiến trúc nhà ở.', image: '/images/v4/hero-house.webp', href: '/du-an', family: 'RESIDENTIAL' },
  { slug: 'khong-gian-mo', title: 'Không gian mở · Khẩu độ lớn', summary: 'Ứng dụng cửa và vách kính để kết nối ánh sáng với không gian sống.', image: '/images/v4/installed-window.jpg', href: '/du-an', family: 'RESIDENTIAL' },
  { slug: 'bien-dang-theo-ung-dung', title: 'Biên dạng theo ứng dụng', summary: 'Từ yêu cầu sử dụng đến profile và bề mặt hoàn thiện phù hợp.', image: '/images/v4/factory-coating-line.jpg', href: '/du-an', family: 'INDUSTRIAL' },
] as const;

export function FeaturedProjects({ content }: { content: HomepageContent }) {
  const projects = mergeHomepageProjects(content.projects, fallback);

  return (
    <section className="hp-section hp-projects" id="projects" data-home-chapter="projects" aria-labelledby="projects-heading">
      <div className="container" data-reveal-group>
        <header className="hp-heading" data-reveal-item>
          <div>
            <p className="hp-kicker">{homepageCopy.projects.eyebrow}</p>
            <h2 id="projects-heading">{homepageCopy.projects.title}</h2>
          </div>
          <p>{homepageCopy.projects.support} <Link className="hp-text-link" href="/du-an">{homepageCopy.projects.action} <ArrowRight size={16} aria-hidden="true" /></Link></p>
        </header>
        <div className="hp-project-grid">
          {projects.map((project, index) => (
            <Link className={`hp-project${index === 0 ? ' hp-project-lead' : ''}`} href={project.href} key={project.slug} data-reveal-item>
              <span className="hp-project-media">
                {project.image
                  ? <Image src={project.image} alt={project.title} fill unoptimized sizes={index === 0 ? '(max-width: 760px) 100vw, 60vw' : '(max-width: 760px) 100vw, 36vw'} />
                  : null}
              </span>
              <span className="hp-project-copy">
                <small>{homepageFamilyLabel(project.family)}</small>
                <strong>{project.title}</strong>
                <span>{project.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
