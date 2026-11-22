import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import type { ProductSystem } from '@/lib/products';

export function ProductCard({ product }: { product: ProductSystem }) {
  return (
    <article className="product-card">
      <Link className="product-media" href={`/san-pham/${product.slug}`} aria-label={`Xem ${product.name}`}>
        <Image src={product.profileImage} alt={`Mặt cắt ${product.name}`} fill sizes="(max-width: 760px) 100vw, 33vw" />
      </Link>
      <div className="product-body">
        <div className="product-meta">
          <span>{product.code}</span>
          <span><ShieldCheck size={14} />{product.warranty}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="product-eyebrow">{product.eyebrow}</p>
        <p>{product.summary}</p>
        <Link className="text-link" href={`/san-pham/${product.slug}`}>
          Xem thông số <ArrowUpRight size={16} />
        </Link>
      </div>
    </article>
  );
}
