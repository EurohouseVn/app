import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { StructuredData } from '@/components/StructuredData';
import { FaqList } from '@/components/explore/FaqList';
import { faqItems } from '@/lib/explore-data';
import { buildPageMetadata } from '@/lib/seo';
import { buildFaqSchema } from '@/lib/structured-data';

export const metadata: Metadata = buildPageMetadata({ title: 'Câu hỏi thường gặp về nhôm Eurohouse', description: 'Giải đáp cách chọn hệ nhôm, tra cứu catalog, gửi bản vẽ nhôm công nghiệp, yêu cầu báo giá và kết nối nhà phân phối EUROHOUSE.', canonicalPath: '/cau-hoi-thuong-gap', image: '/images/v4/installed-window.jpg', imageAlt: 'Câu hỏi thường gặp về sản phẩm nhôm Eurohouse' });
export default function FaqPage() { return <><StructuredData data={buildFaqSchema(faqItems)} /><PageIntro eyebrow="CÂU HỎI THƯỜNG GẶP" title="Thông tin cần biết trước khi liên hệ." summary="Toàn bộ câu hỏi và câu trả lời dưới đây đều hiển thị trên trang; nội dung kỹ thuật riêng vẫn cần xác nhận theo hồ sơ." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Câu hỏi thường gặp' }]} /><section className="home-section faq-section"><div className="container"><FaqList items={faqItems} /></div></section></>; }
