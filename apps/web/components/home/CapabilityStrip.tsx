import { Boxes, ClipboardCheck, Factory, PencilRuler } from 'lucide-react';

const capabilities = [
  { Icon: Factory, title: 'Ép đùn profile', text: 'Phục vụ hệ kiến trúc và yêu cầu kỹ thuật.' },
  { Icon: ClipboardCheck, title: 'Kiểm soát bề mặt', text: 'Theo quy trình và hồ sơ được phê duyệt.' },
  { Icon: PencilRuler, title: 'Mở khuôn theo hồ sơ', text: 'Tiếp nhận bản vẽ để đánh giá kỹ thuật.' },
  { Icon: Boxes, title: 'Hỗ trợ gia công', text: 'Kết nối nhu cầu từ profile đến thành phẩm.' },
] as const;

export function CapabilityStrip() {
  return (
    <section className="capability-strip-v2" aria-label="Năng lực phục vụ">
      <div className="container capability-strip-grid">
        {capabilities.map(({ Icon, title, text }) => <div key={title}><Icon size={23} aria-hidden="true" /><p><strong>{title}</strong><span>{text}</span></p></div>)}
      </div>
    </section>
  );
}
