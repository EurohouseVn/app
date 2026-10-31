import type { Metadata } from 'next';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { ContentGrid } from '@/components/explore/ContentGrid';
import { ProjectFilters } from '@/components/explore/ProjectFilters';
import { filterProjects, normalizeProjectQuery, type ProjectSummary } from '@/lib/explore-content';
import { listPublishedContent } from '@/lib/public-api';

export const metadata: Metadata = { title: 'Dự án', description: 'Thư viện dự án EUROHOUSE chỉ công bố nội dung, hệ sản phẩm và hình ảnh đã được xác nhận.', alternates: { canonical: '/du-an' } };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = normalizeProjectQuery(toParams(await searchParams));
  const projects = filterProjects(await publishedProjects(), query);
  return <><PageIntro eyebrow="DỰ ÁN EUROHOUSE" title="Bằng chứng công trình, không phải danh sách logo." summary="Lọc theo loại dự án, khu vực, hệ nhôm và năm. Một case study chỉ xuất hiện khi nội dung và hình ảnh đã được duyệt." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Dự án' }]} />
    <section className="home-section project-library"><div className="container"><ProjectFilters query={query} /><header className="library-result-heading"><p className="home-eyebrow">Kết quả dự án</p><h2>{projects.length} dự án được công bố</h2></header>{projects.length ? <ContentGrid items={projects.map((item) => ({ title: item.title, summary: item.summary, href: `/du-an/${item.slug}`, eyebrow: [item.type, item.region, item.year].filter(Boolean).join(' · '), image: item.image }))} /> : <EmptyState title="Chưa có dự án phù hợp để công bố" message="Thử xóa bộ lọc hoặc quay lại khi hồ sơ dự án đã hoàn tất xác minh." action={{ label: 'Xóa bộ lọc', href: '/du-an' }} />}</div></section>
  </>;
}

async function publishedProjects(): Promise<ProjectSummary[]> {
  try { const response = await listPublishedContent({ kind: 'CASE_STUDY' }); return response.items.map((item) => ({ slug: item.slug, title: item.title, summary: item.summary, system: item.linkedSystem?.name })); } catch { return []; }
}
function toParams(input: SearchParams) { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((item) => result.append(key, item)); else if (value) result.set(key, value); } return result; }
