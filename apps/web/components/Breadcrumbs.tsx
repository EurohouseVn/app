import Link from 'next/link';
import { buildBreadcrumbSchema } from '@/lib/structured-data';
import { StructuredData } from './StructuredData';

export type BreadcrumbItem = { label: string; href?: string };
type BreadcrumbsProps = { items: readonly BreadcrumbItem[]; className?: string };

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;
  return (
    <>
      <StructuredData data={buildBreadcrumbSchema(items)} />
      <nav className={['breadcrumbs', className].filter(Boolean).join(' ')} aria-label="Đường dẫn trang">
        <ol>
          {items.map((item, index) => {
            const current = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className={index < items.length - 2 ? 'breadcrumb-ancestor' : undefined}>
                {item.href && !current ? <Link href={item.href}>{item.label}</Link> : <span aria-current={current ? 'page' : undefined}>{item.label}</span>}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
