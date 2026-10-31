import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Gửi bản vẽ nhôm công nghiệp', description: 'Gửi hồ sơ để EUROHOUSE đánh giá yêu cầu nhôm công nghiệp.', alternates: { canonical: '/yeu-cau-bao-gia-cong-nghiep' } };
export default function IndustrialRfqPage() { return <><PageIntro eyebrow="Yêu cầu kỹ thuật" title="Gửi bản vẽ nhôm công nghiệp." summary="Chuẩn bị bản vẽ, ứng dụng, sản lượng dự kiến và yêu cầu bề mặt nếu đã có. Đội ngũ EUROHOUSE sẽ phản hồi dữ liệu cần bổ sung." breadcrumbs={[{ label: 'Nhôm công nghiệp', href: '/nhom-cong-nghiep' }, { label: 'Gửi bản vẽ' }]} /><section className="home-section"><div className="container rfq-layout"><div><h2>Hồ sơ nên bao gồm</h2><ol><li>Bản vẽ hoặc mô tả hình học profile.</li><li>Ứng dụng và điều kiện sử dụng.</li><li>Sản lượng hoặc kế hoạch sản xuất dự kiến.</li><li>Yêu cầu bề mặt và thời điểm cần hàng nếu đã xác định.</li></ol></div><aside><h2>Kênh tiếp nhận</h2><p>Bản vẽ là dữ liệu kỹ thuật riêng. Trong giai đoạn này, vui lòng gửi trực tiếp qua email chính thức hoặc liên hệ hotline.</p><a href={`mailto:${site.email}?subject=Yêu cầu nhôm công nghiệp`}><Mail size={18} aria-hidden="true" /> {site.email}</a><a href={site.phoneHref}><Phone size={18} aria-hidden="true" /> {site.phone}</a><Link href="/nhom-cong-nghiep">Quay lại tra cứu dịch vụ</Link></aside></div></section></>; }
