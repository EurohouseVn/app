import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { PageIntro } from '@/components/PageIntro';
import { site } from '@/lib/site';

export const metadata: Metadata = { title: 'Đăng ký Nhà phân phối', description: 'Chuẩn bị thông tin để trao đổi cơ hội hợp tác Nhà phân phối EUROHOUSE.', alternates: { canonical: '/nha-phan-phoi/dang-ky' } };
export default function DistributorRegisterPage() { return <><PageIntro eyebrow="ĐĂNG KÝ TÌM HIỂU" title="Chuẩn bị hồ sơ hợp tác Nhà phân phối." summary="Luồng đăng ký trực tuyến sẽ được nối với CRM ở bước tiếp theo. Hiện tại, vui lòng dùng kênh chính thức để không gửi dữ liệu nhạy cảm vào biểu mẫu chưa hoàn thiện." breadcrumbs={[{ label: 'Nhà phân phối', href: '/nha-phan-phoi' }, { label: 'Đăng ký' }]} /><section className="home-section"><div className="container rfq-layout"><div><h2>Thông tin nên chuẩn bị</h2><ol><li>Tên doanh nghiệp và người liên hệ.</li><li>Khu vực dự kiến hoạt động.</li><li>Nhóm khách hàng và năng lực hiện có.</li><li>Nhu cầu hỗ trợ muốn trao đổi.</li></ol></div><aside><h2>Kênh tiếp nhận</h2><p>Không gửi giá, công nợ hoặc dữ liệu khách hàng qua kênh công khai.</p><a href={`mailto:${site.email}?subject=Đăng ký tìm hiểu NPP`}><Mail size={18} />{site.email}</a><a href={site.phoneHref}><Phone size={18} />{site.phone}</a><Link href="/nha-phan-phoi/chinh-sach">Xem nguyên tắc hợp tác</Link></aside></div></section></>; }
