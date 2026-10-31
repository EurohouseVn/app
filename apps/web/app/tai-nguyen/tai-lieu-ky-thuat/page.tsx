import type { Metadata } from 'next';
import { ResourceDocumentPage } from '@/components/explore/ResourceDocumentPage';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tài liệu kỹ thuật', description: 'Tài liệu kỹ thuật EUROHOUSE theo revision và ngày hiệu lực.', alternates: { canonical: '/tai-nguyen/tai-lieu-ky-thuat' } };
export default function TechnicalDocumentsPage() { return <ResourceDocumentPage title="Tài liệu kỹ thuật" summary="Tài liệu theo hệ sản phẩm được công bố cùng thông tin hiệu lực; liên hệ nếu cần xác nhận bản đang áp dụng." type="TECHNICAL" />; }
