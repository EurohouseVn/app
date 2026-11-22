import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { ProjectFilters } from '@/components/explore/ProjectFilters';
import { filterProjects, normalizeProjectQuery, type ProjectSummary } from '@/lib/explore-content';
import { listPublishedContent } from '@/lib/public-api';
import { ProjectGallery } from '@/components/explore/ProjectGallery';
import '../projects.css';

export const metadata: Metadata = { title: 'Dự án', description: 'Thư viện dự án EUROHOUSE chỉ công bố nội dung, hệ sản phẩm và hình ảnh đã được xác nhận.', alternates: { canonical: '/du-an' } };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = normalizeProjectQuery(toParams(await searchParams));
  const projects = filterProjects(await publishedProjects(), query);
  const hasLibrary = projects.length > 0 || toParams(await searchParams).toString() !== '';
  return <><PageIntro eyebrow="DỰ ÁN EUROHOUSE" title="Công trình thực tế dùng nhôm EUROHOUSE." summary="Ảnh chụp tại công trình và xưởng: cửa đi, cửa sổ, vách kính và mẫu hoàn thiện. Chọn nhóm để xem, bấm vào ảnh để xem lớn." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Dự án' }]} />
    <section className="home-section"><div className="container"><ProjectGallery /><p className="pg-note">Ảnh được lấy từ kho tư liệu của EUROHOUSE, không ghi tên chủ nhà và địa điểm. Cần xem hồ sơ kỹ thuật của một công trình cụ thể, hãy liên hệ để được gửi tài liệu đã xác nhận.</p></div></section>
    {hasLibrary ? <section className="home-section project-library"><div className="container"><ProjectFilters query={query} /><header className="library-result-heading"><p className="home-eyebrow">Kết quả dự án</p><h2>{projects.length} dự án được công bố</h2></header>{projects.length ? <ContentGrid items={projects.map((item) => ({ title: item.title, summary: item.summary, href: `/du-an/${item.slug}`, eyebrow: [item.type, item.region, item.year].filter(Boolean).join(' · '), image: item.image }))} /> : <EmptyState title="Chưa có dự án phù hợp để công bố" message="Thử xóa bộ lọc hoặc quay lại khi hồ sơ dự án đã hoàn tất xác minh." action={{ label: 'Xóa bộ lọc', href: '/du-an' }} />}</div></section> : null}
  </>;
}

async function publishedProjects(): Promise<ProjectSummary[]> {
  try { const response = await listPublishedContent({ kind: 'CASE_STUDY' }); return response.items.map((item) => ({ slug: item.slug, title: item.title, summary: item.summary, system: item.linkedSystem?.name })); } catch { return []; }
}
function toParams(input: SearchParams) { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((item) => result.append(key, item)); else if (value) result.set(key, value); } return result; }
