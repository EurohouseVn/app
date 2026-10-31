import type { ReactNode } from 'react';
import { Breadcrumbs, type BreadcrumbItem } from './Breadcrumbs';

type PageIntroProps = {
  eyebrow?: string;
  title: string;
  summary?: string;
  breadcrumbs?: readonly BreadcrumbItem[];
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageIntro({ eyebrow, title, summary, breadcrumbs, actions, children, className }: PageIntroProps) {
  return (
    <section className={['page-intro', className].filter(Boolean).join(' ')}>
      <div className="container page-intro-inner">
        {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
        <div className="page-intro-grid">
          <div>
            {eyebrow ? <p className="page-intro-eyebrow">{eyebrow}</p> : null}
            <h1>{title}</h1>
          </div>
          {summary || actions ? <div className="page-intro-support">{summary ? <p>{summary}</p> : null}{actions ? <div className="page-intro-actions">{actions}</div> : null}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}
