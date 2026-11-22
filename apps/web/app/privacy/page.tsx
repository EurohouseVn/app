import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chính sách quyền riêng tư', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return <LegalPage title="Chính sách quyền riêng tư" updated="30/10/2026" sections={[
    ['Phạm vi áp dụng', 'Chính sách này áp dụng cho website nhomeurohouse.com, ứng dụng EUROHOUSE Workshop và các cổng dịch vụ Eurohouse do LELOI EXIM GLOBAL vận hành.'],
    ['Dữ liệu được thu thập', 'Tùy tính năng sử dụng, hệ thống có thể xử lý thông tin tài khoản, số điện thoại, địa chỉ, thông tin cơ sở sản xuất, dữ liệu công trình, đơn hàng, ảnh người dùng chủ động tải lên, vị trí khi người dùng cho phép và dữ liệu chẩn đoán kỹ thuật.'],
    ['Mục đích sử dụng', 'Dữ liệu được dùng để xác thực tài khoản, cung cấp tính năng vận hành xưởng, xử lý đơn hàng, tạo tài liệu PDF, cung cấp dự báo thời tiết, hỗ trợ khách hàng, bảo mật và cải thiện độ ổn định dịch vụ.'],
    ['Chia sẻ và lưu trữ', 'Eurohouse chỉ chia sẻ dữ liệu với đơn vị xử lý hạ tầng cần thiết, nhà phân phối phụ trách đơn hàng hoặc cơ quan có thẩm quyền khi pháp luật yêu cầu. Dữ liệu không được bán cho bên thứ ba.'],
    ['Quyền của người dùng', 'Người dùng có thể yêu cầu truy cập, chỉnh sửa hoặc xóa tài khoản và dữ liệu liên quan qua trang Yêu cầu xóa tài khoản hoặc email hỗ trợ. Một số chứng từ có thể được lưu theo nghĩa vụ kế toán và pháp luật.'],
    ['Liên hệ', 'Mọi yêu cầu về dữ liệu cá nhân gửi tới vneurohouse@gmail.com, tiêu đề “Quyền riêng tư - EUROHOUSE Workshop”.'],
  ]} />;
}

function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: Array<[string, string]> }) {
  return <><section className="page-hero legal-hero"><div className="container"><p className="kicker">Pháp lý</p><h1>{title}</h1><p>Cập nhật lần cuối: {updated}</p></div></section><article className="legal-copy container">{sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</article></>;
}
