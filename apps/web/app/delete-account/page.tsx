import type { Metadata } from 'next';
import { ContactForm } from '@/components/ContactForm';

export const metadata: Metadata = { title: 'Yêu cầu xóa tài khoản', alternates: { canonical: '/delete-account' } };

export default function DeleteAccountPage() {
  return <><section className="page-hero compact-hero"><div className="container"><p className="kicker">Quyền tài khoản</p><h1>Yêu cầu xóa tài khoản</h1><p>Áp dụng cho tài khoản EUROHOUSE Workshop và các dữ liệu cá nhân liên quan.</p></div></section><section className="section page-section"><div className="container delete-layout"><div><h2>Quy trình xử lý</h2><ol className="delete-steps"><li><span>01</span><p>Nhập đúng họ tên, số điện thoại hoặc email đã đăng ký.</p></li><li><span>02</span><p>Chọn nhu cầu “Hỗ trợ ứng dụng” và ghi rõ “Yêu cầu xóa tài khoản”.</p></li><li><span>03</span><p>Eurohouse xác minh quyền sở hữu và phản hồi thời gian hoàn tất.</p></li></ol><p>Một số hóa đơn, chứng từ hoặc lịch sử giao dịch có thể được lưu theo nghĩa vụ pháp luật và sẽ không còn dùng cho mục đích tiếp thị.</p></div><ContactForm compact /></div></section></>;
}
