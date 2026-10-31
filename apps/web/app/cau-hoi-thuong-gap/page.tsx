import type { Metadata } from 'next';
import { PageIntro } from '@/components/PageIntro';
import { StructuredData } from '@/components/StructuredData';
import { FaqList } from '@/components/explore/FaqList';
import { faqItems } from '@/lib/explore-data';

export const metadata: Metadata = { title: 'Câu hỏi thường gặp', description: 'Giải đáp về sản phẩm, bản vẽ công nghiệp, tài liệu kỹ thuật và Cổng NPP EUROHOUSE.', alternates: { canonical: '/cau-hoi-thuong-gap' } };
export default function FaqPage() { return <><StructuredData data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqItems.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) }} /><PageIntro eyebrow="CÂU HỎI THƯỜNG GẶP" title="Thông tin cần biết trước khi liên hệ." summary="Toàn bộ câu hỏi và câu trả lời dưới đây đều hiển thị trên trang; nội dung kỹ thuật riêng vẫn cần xác nhận theo hồ sơ." breadcrumbs={[{ label: 'Trang chủ', href: '/' }, { label: 'Câu hỏi thường gặp' }]} /><section className="home-section faq-section"><div className="container"><FaqList items={faqItems} /></div></section></>; }
