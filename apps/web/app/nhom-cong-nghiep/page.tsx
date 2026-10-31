import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Upload } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { IndustrialExplorer } from '@/components/industrial/IndustrialExplorer';
import { IndustrialProcess } from '@/components/industrial/IndustrialProcess';
import { filterIndustrialServices, normalizeIndustrialQuery } from '@/lib/industrial-query';
import { industrialServices } from '@/lib/industrial-content';

export const metadata: Metadata = { title: 'Nhôm công nghiệp', description: 'Định hình theo bản vẽ, chi tiết máy, nhôm năng lượng mặt trời, đùn thuê và gia công nhôm EUROHOUSE.', alternates: { canonical: '/nhom-cong-nghiep' } };
type SearchParams = Record<string, string | string[] | undefined>;

export default async function IndustrialPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = normalizeIndustrialQuery(toUrlSearchParams(await searchParams));
  const results = filterIndustrialServices(industrialServices, query);
  return <>
    <PageIntro eyebrow="NHÔM CÔNG NGHIỆP" title="Tìm năng lực theo bài toán kỹ thuật." summary="Tra cứu dịch vụ theo ứng dụng, sau đó gửi hồ sơ để EUROHOUSE đánh giá khả năng triển khai. Các thông số chưa được duyệt sẽ luôn hiển thị là cần xác nhận." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Nhôm công nghiệp' }]} actions={<Link className="home-button home-button-primary" href="/yeu-cau-bao-gia-cong-nghiep"><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link>} />
    <IndustrialExplorer query={query} results={results} />
    <section className="industrial-evidence"><div className="container"><div className="industrial-evidence-image"><Image src="/images/v5/factory-coating.webp" alt="Khu vực dây chuyền phục vụ xử lý profile nhôm" fill unoptimized sizes="(max-width: 800px) 100vw, 55vw" /></div><div><p className="home-eyebrow">Năng lực có kiểm chứng</p><h2>Chỉ công bố điều đã có hồ sơ.</h2><p>Vật liệu, dung sai, bề mặt, sản lượng tối thiểu, tiến độ và phạm vi gia công được xác nhận theo từng yêu cầu. Website không tự suy diễn thông số.</p><Link className="home-text-link" href="/nang-luc">Xem năng lực EUROHOUSE <ArrowRight size={16} aria-hidden="true" /></Link></div></div></section>
    <IndustrialProcess />
    <Link className="industrial-mobile-rfq" href="/yeu-cau-bao-gia-cong-nghiep"><Upload size={17} aria-hidden="true" /> Gửi bản vẽ</Link>
  </>;
}

function toUrlSearchParams(input: SearchParams): URLSearchParams { const result = new URLSearchParams(); for (const [key, value] of Object.entries(input)) { if (Array.isArray(value)) value.forEach((entry) => result.append(key, entry)); else if (value) result.set(key, value); } return result; }
