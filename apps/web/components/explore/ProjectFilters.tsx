import { Search } from 'lucide-react';
import { PROJECT_REGIONS, PROJECT_SYSTEMS, PROJECT_TYPES, PROJECT_YEARS, type ProjectQuery } from '@/lib/explore-content';

export function ProjectFilters({ query }: { query: ProjectQuery }) {
  return <form className="project-filters" action="/du-an" method="get">
    <label className="project-search"><span>Tìm dự án</span><span><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={query.q} placeholder="Tên hoặc ứng dụng" /></span></label>
    <FilterSelect label="Loại dự án" name="type" value={query.types[0]} options={PROJECT_TYPES} />
    <FilterSelect label="Tỉnh / khu vực" name="region" value={query.regions[0]} options={PROJECT_REGIONS} />
    <FilterSelect label="Hệ nhôm" name="system" value={query.systems[0]} options={PROJECT_SYSTEMS} />
    <FilterSelect label="Năm" name="year" value={query.years[0]} options={PROJECT_YEARS} />
    <button className="home-button home-button-primary" type="submit">Lọc dự án</button>
    <a href="/du-an">Xóa bộ lọc</a>
  </form>;
}

function FilterSelect({ label, name, value, options }: { label: string; name: string; value?: string; options: readonly string[] }) {
  return <label><span>{label}</span><select name={name} defaultValue={value || ''}><option value="">Tất cả</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
