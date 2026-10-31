import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function ConsultationCta({ title = 'Cần chọn hệ nhôm cho công trình?', description = 'Gửi nhu cầu sử dụng và khu vực dự án để đội ngũ EUROHOUSE hỗ trợ đúng nhóm sản phẩm.' }: { title?: string; description?: string }) {
  return <section className="residential-cta"><div className="container"><div><p className="home-eyebrow">Tư vấn sản phẩm</p><h2>{title}</h2><p>{description}</p></div><Link className="home-button home-button-primary" href="/lien-he">Gửi yêu cầu tư vấn <ArrowRight size={17} aria-hidden="true" /></Link></div></section>;
}
