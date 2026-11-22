import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Điều khoản sử dụng', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  const sections = [
    ['Chấp thuận điều khoản', 'Khi truy cập website hoặc sử dụng ứng dụng Eurohouse, người dùng đồng ý cung cấp thông tin chính xác, bảo vệ thông tin đăng nhập và tuân thủ pháp luật hiện hành.'],
    ['Thông tin kỹ thuật', 'Catalog, công thức và dữ liệu kỹ thuật là tài liệu hỗ trợ. Người sử dụng phải kiểm tra hiện trạng, phiên bản dữ liệu và yêu cầu công trình trước khi sản xuất.'],
    ['Giá và giao dịch', 'Khối lượng hiển thị khi đặt nhôm là dự tính. Giá trị chính thức chỉ được ghi nhận sau khi nhà phân phối xác nhận khối lượng cân thực tế và đơn giá áp dụng tại khu vực.'],
    ['Tài khoản', 'Người dùng chịu trách nhiệm đối với hoạt động phát sinh từ tài khoản của mình. Eurohouse có thể tạm khóa tài khoản có dấu hiệu lạm dụng, gian lận hoặc gây rủi ro an toàn hệ thống.'],
    ['Sở hữu trí tuệ', 'Nhãn hiệu, catalog, hình ảnh, dữ liệu profile và phần mềm Eurohouse thuộc chủ sở hữu hoặc bên cấp phép tương ứng và không được sao chép để kinh doanh khi chưa được chấp thuận.'],
    ['Giới hạn trách nhiệm', 'Dịch vụ được vận hành với nỗ lực hợp lý. Eurohouse không chịu trách nhiệm cho sai số do dữ liệu người dùng nhập, điều kiện thi công thực tế hoặc việc sử dụng tài liệu sai phiên bản.'],
  ];
  return <><section className="page-hero legal-hero"><div className="container"><p className="kicker">Pháp lý</p><h1>Điều khoản sử dụng</h1><p>Cập nhật lần cuối: 30/10/2026</p></div></section><article className="legal-copy container">{sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</article></>;
}
