import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { SearchAnalytics } from '@/components/explore/SearchAnalytics';
import { baseSiteSearchIndex } from '@/lib/explore-data';
import { publicContentHref, searchSiteIndex, type SiteSearchEntry } from '@/lib/explore-content';
import { searchPublishedContent } from '@/lib/public-api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tìm kiếm', description: 'Tìm sản phẩm, dịch vụ, dự án, tài liệu và kiến thức trên website EUROHOUSE.', alternates: { canonical: '/tim-kiem' } };
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim() || '';
  const local = searchSiteIndex(baseSiteSearchIndex, q);
  const published = q ? await publishedResults(q) : [];
  const results = dedupe([...published, ...local]);
  return <><PageIntro eyebrow="TÌM KIẾM TOÀN WEBSITE" title="Tìm đúng hệ, dịch vụ hoặc tài liệu." summary="Kết quả chỉ gồm nội dung công khai. Dữ liệu Admin và Cổng NPP không được đưa vào tìm kiếm." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Tìm kiếm' }]}><form className="global-search-form" action="/tim-kiem" method="get"><Search size={19} aria-hidden="true" /><input type="search" name="q" defaultValue={q} placeholder="Nhập sản phẩm, ứng dụng hoặc tài liệu" /><button className="home-button home-button-primary" type="submit">Tìm kiếm</button></form></PageIntro><SearchAnalytics query={q} resultCount={results.length} />
    <section className="home-section search-results"><div className="container"><header className="library-result-heading"><p className="home-eyebrow">Kết quả công khai</p><h2>{q ? `${results.length} kết quả cho “${q}”` : 'Nhập từ khóa để bắt đầu'}</h2></header>{q && results.length ? <div className="search-result-list">{results.map((item) => <Link href={item.href} key={item.href}><small>{item.kind}</small><strong>{item.title}</strong><span>{item.summary}</span><b>Xem nội dung <ArrowRight size={16} /></b></Link>)}</div> : q ? <EmptyState title="Chưa tìm thấy nội dung phù hợp" message="Thử từ khóa ngắn hơn hoặc mở hai nhóm sản phẩm chính." action={{ label: 'Xem Nhôm dân dụng', href: '/nhom-dan-dung' }} /> : null}</div></section>
  </>;
}

async function publishedResults(q: string): Promise<SiteSearchEntry[]> { try { const response = await searchPublishedContent({ q }); return response.items.map((item) => ({ title: item.title, summary: item.summary, href: publicContentHref(item.kind, item.slug, item.family), kind: kindLabel(item.kind) })); } catch { return []; } }
function dedupe(items: SiteSearchEntry[]) { return [...new Map(items.map((item) => [item.href, item])).values()]; }
function kindLabel(kind: string) { return ({ CASE_STUDY: 'Dự án', VIDEO: 'Video', ARTICLE: 'Kiến thức', PRODUCT: 'Sản phẩm', INDUSTRIAL_SERVICE: 'Dịch vụ' } as Record<string, string>)[kind] || 'Nội dung'; }
