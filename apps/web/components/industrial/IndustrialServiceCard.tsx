import Link from 'next/link';
import { ArrowRight, FileCheck2 } from 'lucide-react';
import type { IndustrialService } from '@/lib/industrial-content';

export function IndustrialServiceCard({ service }: { service: IndustrialService }) {
  return <article className="industrial-result-card"><div><FileCheck2 size={22} aria-hidden="true" /><span>{service.applications.join(' · ')}</span></div><h2>{service.title}</h2><p>{service.summary}</p><div className="industrial-result-actions"><Link href={`/nhom-cong-nghiep/${service.slug}`}>Xem năng lực <ArrowRight size={16} aria-hidden="true" /></Link><Link href={`/yeu-cau-bao-gia-cong-nghiep?service=${service.slug}`}>Gửi bản vẽ</Link></div></article>;
}
