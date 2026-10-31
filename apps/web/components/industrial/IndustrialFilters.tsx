import { Search } from 'lucide-react';
import { industrialApplications, industrialServices } from '@/lib/industrial-content';
import type { IndustrialQuery } from '@/lib/industrial-query';

export function IndustrialFilters({ query }: { query: IndustrialQuery }) {
  return <form className="industrial-filters" action="/nhom-cong-nghiep" method="get">
    <label className="industrial-search"><span>Tìm theo tên, ứng dụng hoặc dịch vụ</span><span><Search size={18} aria-hidden="true" /><input name="q" defaultValue={query.q} placeholder="Ví dụ: chi tiết máy, năng lượng…" /></span></label>
    <fieldset><legend>Dịch vụ</legend>{industrialServices.map((item) => <label key={item.slug}><input type="checkbox" name="service" value={item.slug} defaultChecked={query.services.includes(item.slug)} /><span>{item.title}</span></label>)}</fieldset>
    <fieldset><legend>Ứng dụng</legend>{industrialApplications.map((application) => <label key={application}><input type="checkbox" name="application" value={application} defaultChecked={query.applications.includes(application)} /><span>{application}</span></label>)}</fieldset>
    <div className="industrial-filter-actions"><button className="home-button home-button-primary" type="submit">Áp dụng bộ lọc</button><a href="/nhom-cong-nghiep">Xóa bộ lọc</a></div>
  </form>;
}
