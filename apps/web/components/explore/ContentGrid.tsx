import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ImageOff } from 'lucide-react';

export type ContentGridItem = { title: string; summary: string; href: string; eyebrow?: string; image?: string };

export function ContentGrid({ items, className = '' }: { items: readonly ContentGridItem[]; className?: string }) {
  return <div className={`explore-card-grid ${className}`.trim()}>{items.map((item) => <Link className="explore-card" href={item.href} key={item.href}>
    <span className="explore-card-media">{item.image ? <Image src={item.image} alt="" fill unoptimized sizes="(max-width: 700px) 100vw, 33vw" /> : <span className="explore-card-placeholder"><ImageOff size={24} aria-hidden="true" /> Chưa có ảnh được duyệt</span>}</span>
    <span className="explore-card-copy">{item.eyebrow ? <small>{item.eyebrow}</small> : null}<strong>{item.title}</strong><span>{item.summary}</span><b>Xem nội dung <ArrowRight size={16} aria-hidden="true" /></b></span>
  </Link>)}</div>;
}
