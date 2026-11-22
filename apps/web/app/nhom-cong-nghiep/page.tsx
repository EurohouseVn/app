import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Upload } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { IndustrialExplorer } from '@/components/industrial/IndustrialExplorer';
import { IndustrialProcess } from '@/components/industrial/IndustrialProcess';
import { filterIndustrialServices, normalizeIndustrialQuery } from '@/lib/industrial-query';
import { industrialServices } from '@/lib/industrial-content';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({ title: 'Nhôm công nghiệp theo yêu cầu', description: 'EUROHOUSE tiếp nhận nhôm định hình theo bản vẽ, profile chi tiết máy, nhôm năng lượng mặt trời, đùn thuê và gia công sản phẩm nhôm.', canonicalPath: '/nhom-cong-nghiep', image: '/images/v4/factory-coating-line.jpg', imageAlt: 'Năng lực phục vụ nhôm công nghiệp Eurohouse' });
type SearchParams = Record<string, string | string[] | undefined>;

export default async function IndustrialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = normalizeIndustrialQuery(toUrlSearchParams(await searchParams));
  const results = filterIndustrialServices(industrialServices, query);
  return <>
    <PageIntro eyebrow="NHÔM CÔNG NGHIỆP" title="Bắt đầu từ ứng dụng hoặc bản vẽ của bạn." summary="Tìm đúng nhóm dịch vụ cho profile, chi tiết máy, khung pin năng lượng mặt trời, đùn thuê và gia công. Gửi bản vẽ để đội ngũ EUROHOUSE cùng trao đổi phương án phù hợp." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Nhôm công nghiệp' }]} actions={<Link className="home-button home-button-primary" href="/yeu-cau-bao-gia-cong-nghiep"><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link>} />
    <IndustrialExplorer query={query} results={results} />
    <section className="industrial-evidence"><div className="container"><div className="industrial-evidence-image"><Image src="/images/v4/factory-coating-line.jpg" alt="Khu vực dây chuyền phục vụ xử lý profile nhôm" fill unoptimized sizes="(max-width: 800px) 100vw, 55vw" /></div><div><p className="home-eyebrow">Từ yêu cầu đến phương án</p><h2>Mỗi profile bắt đầu từ mục đích sử dụng.</h2><p>Hãy gửi bản vẽ cùng thông tin lắp ghép, bề mặt, sản lượng và tiến độ mong muốn. Đội ngũ EUROHOUSE sẽ tập trung làm rõ những yếu tố ảnh hưởng trực tiếp đến khả năng triển khai.</p><Link className="home-text-link" href="/nang-luc">Khám phá năng lực EUROHOUSE <ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>
    <IndustrialProcess />
    <Link className="industrial-mobile-rfq" href="/yeu-cau-bao-gia-cong-nghiep"><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link>
  </>;
}

function toUrlSearchParams(input: SearchParams): URLSearchParams { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((entry) => result.append(key, entry)); else if (value) result.set(key, value); } return result; }
