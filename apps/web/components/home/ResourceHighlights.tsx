import Link from 'next/link';
import { ArrowRight, BookOpen, FileText, Library } from 'lucide-react';

const resources = [
  { Icon: BookOpen, title: 'Catalog sản phẩm', text: 'Tra cứu dòng nhôm, hệ chuyên dụng và thông tin công bố.', href: '/tai-nguyen/catalog' },
  { Icon: FileText, title: 'Hồ sơ năng lực', text: 'Tổng quan doanh nghiệp, năng lực phục vụ và hệ sinh thái.', href: '/tai-nguyen/profile' },
  { Icon: Library, title: 'Tài liệu kỹ thuật', text: 'Tập trung bản vẽ, hướng dẫn và tài liệu theo phiên bản.', href: '/tai-nguyen/tai-lieu-ky-thuat' },
] as const;

export function ResourceHighlights() {
  return (
    <section className="home-section resource-section" id="resources" aria-labelledby="resource-heading">
      <div className="container">
        <header className="home-section-heading"><p className="home-eyebrow">Trung tâm tài nguyên</p><h2 id="resource-heading">Tài liệu đúng phiên bản, tìm thấy nhanh.</h2></header>
        <div className="resource-grid">{resources.map(({ Icon, title, text, href }) => <Link href={href} key={title}><Icon size={24} aria-hidden="true" /><strong>{title}</strong><span>{text}</span><b>Mở tài nguyên <ArrowRight size={16} aria-hidden="true" /></b></Link>)}</div>
      </div>
    </section>
  );
}
