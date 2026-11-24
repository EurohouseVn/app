import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Chính sách quyền riêng tư', alternates: { canonical: '/privacy' } };

type Section = [heading: string, body: string[]];

const SECTIONS: Section[] = [
  ['Đơn vị vận hành và phạm vi áp dụng', [
    'Chính sách này áp dụng cho website nhomeurohouse.com, ứng dụng di động EUROHOUSE (tên gói com.nhomeurohouse.app) và các cổng dịch vụ Eurohouse do LELOI EXIM GLOBAL vận hành.',
    'Ứng dụng dành cho người từ 18 tuổi trở lên làm việc trong ngành nhôm kính, gồm chủ xưởng, thợ, đại lý và nhà phân phối.',
  ]],
  ['Dữ liệu chúng tôi thu thập', [
    'Thông tin tài khoản: tên cơ sở sản xuất hoặc tên hiển thị, số điện thoại, email (nếu bạn đăng ký bằng email), địa chỉ và mật khẩu. Mật khẩu được lưu dưới dạng băm một chiều, chúng tôi không đọc được mật khẩu của bạn.',
    'Dữ liệu bạn chủ động nhập: công trình, báo giá, đơn hàng, công thức cắt, chi phí, thu chi, hóa đơn và thông tin thuế, thông tin thợ và lương khoán, nội dung trò chuyện với trợ lý Bé Eu.',
    'Hình ảnh: ảnh bạn chọn hoặc chụp để đính kèm công trình, hồ sơ hoặc bảo hành, và hình ảnh quét mã QR. Ứng dụng chỉ dùng máy ảnh khi bạn mở tính năng đó.',
    'Vị trí gần đúng: chỉ khi bạn cho phép, để hiển thị dự báo thời tiết tại khu vực của bạn. Chúng tôi không thu thập vị trí chính xác và không theo dõi vị trí nền.',
    'Dữ liệu kỹ thuật tối thiểu: phiên bản ứng dụng, loại thiết bị và nhật ký lỗi để bảo mật và giữ dịch vụ ổn định.',
    'Chúng tôi không thu thập danh bạ, tin nhắn, ghi âm, thư viện ảnh ngoài những ảnh bạn tự chọn, và không dùng định danh quảng cáo.',
  ]],
  ['Mục đích sử dụng', [
    'Xác thực và bảo vệ tài khoản; cung cấp tính năng quản lý xưởng, báo giá, đặt hàng, công thức, hóa đơn, bảo hành và tích điểm; tạo tài liệu PDF; cung cấp dự báo thời tiết; hỗ trợ khách hàng; chống gian lận; cải thiện độ ổn định của dịch vụ.',
    'Chúng tôi không hiển thị quảng cáo trong ứng dụng và không bán dữ liệu cá nhân.',
  ]],
  ['Trợ lý Bé Eu (trí tuệ nhân tạo)', [
    'Khi bạn trò chuyện với Bé Eu, nội dung câu hỏi và quy tắc riêng của xưởng bạn được gửi tới một dịch vụ trí tuệ nhân tạo do chúng tôi sử dụng để tạo câu trả lời. Hội thoại được lưu gắn với xưởng của bạn để Bé Eu nhớ ngữ cảnh.',
    'Vì vậy, vui lòng không nhập số căn cước, số tài khoản ngân hàng hoặc mật khẩu vào khung trò chuyện. Câu trả lời của Bé Eu mang tính tham khảo.',
  ]],
  ['Chia sẻ dữ liệu', [
    'Chúng tôi chỉ chia sẻ dữ liệu trong các trường hợp: (1) đơn vị cung cấp hạ tầng lưu trữ và xử lý cần thiết để vận hành dịch vụ; (2) nhà phân phối phụ trách đơn hàng của bạn, khi bạn đặt hàng qua mạng lưới Eurohouse; (3) nhà cung cấp dịch vụ hóa đơn điện tử, khi bạn chủ động lập hóa đơn; (4) nhà cung cấp dự báo thời tiết, chỉ nhận khu vực gần đúng; (5) nhà cung cấp dịch vụ trí tuệ nhân tạo cho tính năng Bé Eu; (6) cơ quan có thẩm quyền khi pháp luật yêu cầu.',
    'Dữ liệu cá nhân không được bán cho bên thứ ba.',
  ]],
  ['Bảo mật và thời gian lưu trữ', [
    'Dữ liệu được truyền qua kết nối mã hóa HTTPS. Phiên đăng nhập trên điện thoại được lưu trong vùng lưu trữ bảo mật của hệ điều hành. Mỗi xưởng chỉ xem được dữ liệu của chính xưởng mình.',
    'Chúng tôi lưu dữ liệu trong thời gian tài khoản còn hoạt động. Sau khi xóa tài khoản, dữ liệu cá nhân được xóa hoặc ẩn danh hóa; một số chứng từ, hóa đơn và lịch sử giao dịch có thể được giữ theo nghĩa vụ kế toán và pháp luật, và không còn dùng cho mục đích khác.',
  ]],
  ['Quyền của bạn', [
    'Bạn có thể yêu cầu truy cập, chỉnh sửa hoặc xóa tài khoản và dữ liệu liên quan. Có thể chỉnh sửa thông tin cơ bản ngay trong ứng dụng ở mục Tài khoản. Để xóa tài khoản, vào ứng dụng, mục Tài khoản, chọn “Xóa tài khoản” và nhập mật khẩu để xác nhận; tài khoản bị khóa và dữ liệu cá nhân được ẩn danh hóa ngay. Nếu không còn truy cập được ứng dụng, gửi yêu cầu tại trang https://nhomeurohouse.com/delete-account hoặc qua email bên dưới; chúng tôi xác minh quyền sở hữu và phản hồi trong vòng 30 ngày.',
    'Bạn có thể thu hồi quyền máy ảnh và vị trí bất cứ lúc nào trong phần Cài đặt của điện thoại; các tính năng liên quan sẽ ngừng hoạt động nhưng phần còn lại của ứng dụng vẫn dùng được.',
  ]],
  ['Thay đổi chính sách', [
    'Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang. Thay đổi quan trọng sẽ được thông báo trong ứng dụng hoặc trên website.',
  ]],
  ['Liên hệ', [
    'Mọi yêu cầu về dữ liệu cá nhân gửi tới vneurohouse@gmail.com, tiêu đề “Quyền riêng tư - EUROHOUSE”. Đơn vị phụ trách: LELOI EXIM GLOBAL.',
  ]],
];

export default function PrivacyPage() {
  return <LegalPage title="Chính sách quyền riêng tư" updated="24/11/2026" sections={SECTIONS} />;
}

function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: Section[] }) {
  return (
    <>
      <section className="page-hero legal-hero"><div className="container"><p className="kicker">Pháp lý</p><h1>{title}</h1><p>Cập nhật lần cuối: {updated}</p></div></section>
      <article className="legal-copy container">
        {sections.map(([heading, body]) => (
          <section key={heading}><h2>{heading}</h2>{body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>
        ))}
      </article>
    </>
  );
}
