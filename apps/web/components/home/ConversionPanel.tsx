import Link from 'next/link';
import { ArrowRight, FileUp, MessagesSquare } from 'lucide-react';

export function ConversionPanel() {
  return (
    <section className="home-section conversion-section" id="consultation" aria-labelledby="conversion-heading">
      <div className="container conversion-panel">
        <div><p className="home-eyebrow">Bước tiếp theo</p><h2 id="conversion-heading">Bạn đang tìm hệ nhôm hay cần triển khai một profile riêng?</h2></div>
        <div className="conversion-actions">
          <Link href="/lien-he"><MessagesSquare size={21} aria-hidden="true" /><span><strong>Tư vấn dân dụng &amp; dự án</strong><small>Trao đổi hệ nhôm và nhu cầu công trình.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/yeu-cau-bao-gia-cong-nghiep"><FileUp size={21} aria-hidden="true" /><span><strong>Gửi bản vẽ công nghiệp</strong><small>Chuyển hồ sơ để đánh giá kỹ thuật.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
