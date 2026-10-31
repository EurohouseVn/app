import { EmptyState } from '@/components/EmptyState';
import type { IndustrialService } from '@/lib/industrial-content';
import type { IndustrialQuery } from '@/lib/industrial-query';
import { IndustrialFilters } from './IndustrialFilters';
import { IndustrialServiceCard } from './IndustrialServiceCard';

export function IndustrialExplorer({ query, results }: { query: IndustrialQuery; results: IndustrialService[] }) {
  return <section className="home-section industrial-explorer" id="explorer"><div className="container industrial-explorer-layout"><aside><IndustrialFilters query={query} /></aside><div className="industrial-results"><header><p className="home-eyebrow">Kết quả kỹ thuật</p><h2>{results.length} dịch vụ phù hợp</h2><p>Kết quả ban đầu được tạo trên máy chủ và có thể chia sẻ bằng URL hiện tại.</p></header>{results.length > 0 ? <div className="industrial-result-list">{results.map((service) => <IndustrialServiceCard service={service} key={service.slug} />)}</div> : <EmptyState title="Chưa tìm thấy dịch vụ phù hợp" message="Thử bỏ bớt bộ lọc hoặc gửi trực tiếp bản vẽ để đội ngũ kỹ thuật xem xét." action={{ label: 'Gửi bản vẽ kỹ thuật', href: '/yeu-cau-bao-gia-cong-nghiep' }} />}</div></div></section>;
}
