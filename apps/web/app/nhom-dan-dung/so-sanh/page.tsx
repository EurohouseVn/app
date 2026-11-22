import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '@/components/EmptyState';
import { PageIntro } from '@/components/PageIntro';
import { residentialProducts } from '@/lib/residential-content';

export const metadata: Metadata = { title: 'So sánh hệ nhôm dân dụng', description: 'So sánh các trường thông tin đang được công bố của hệ nhôm EUROHOUSE.', alternates: { canonical: '/nhom-dan-dung/so-sanh' } };
export default function ComparisonPage() {
  if (residentialProducts.length < 2) return <><PageIntro title="So sánh hệ nhôm" /><div className="container home-section"><EmptyState title="Chưa đủ dữ liệu để so sánh" message="Cần tối thiểu hai hệ có cùng trường thông tin đã xác thực." action={{ label: 'Quay lại Nhôm dân dụng', href: '/nhom-dan-dung' }} /></div></>;
  return <><PageIntro eyebrow="Công cụ lựa chọn" title="So sánh hệ nhôm dân dụng." summary="Đặt các hệ nhôm cạnh nhau để chọn nhanh theo nhóm sản phẩm và ứng dụng phù hợp với công trình." breadcrumbs={[{ label: 'Nhôm dân dụng', href: '/nhom-dan-dung' }, { label: 'So sánh' }]} /><section className="home-section"><div className="container comparison-scroll"><table className="comparison-table"><caption>So sánh các hệ nhôm EUROHOUSE</caption><thead><tr><th>Tiêu chí</th>{residentialProducts.map((item) => <th key={item.slug}><Link href={`/nhom-dan-dung/dong-san-pham/${item.slug}`}>{item.title}</Link></th>)}</tr></thead><tbody><tr><th>Mã nhận diện</th>{residentialProducts.map((item) => <td key={item.slug}>{item.code}</td>)}</tr><tr><th>Nhóm</th>{residentialProducts.map((item) => <td key={item.slug}>{item.eyebrow}</td>)}</tr><tr><th>Ứng dụng</th>{residentialProducts.map((item) => <td key={item.slug}>{item.applications.join(', ')}</td>)}</tr><tr><th>Cập nhật</th>{residentialProducts.map((item) => <td key={item.slug}>Thông tin EUROHOUSE · 30/10/2026</td>)}</tr></tbody></table></div></section></>;
}
