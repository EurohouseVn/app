import type { Metadata } from 'next';
import { ResourceDocumentPage } from '@/components/explore/ResourceDocumentPage';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Catalog EUROHOUSE', description: 'Catalog EUROHOUSE công khai theo phiên bản và ngày hiệu lực.', alternates: { canonical: '/tai-nguyen/catalog' } };
export default function CatalogPage() { return <ResourceDocumentPage title="Catalog EUROHOUSE" summary="Tra cứu catalog chính thức theo hệ sản phẩm; luôn đối chiếu revision trước khi dùng cho sản xuất hoặc thi công." type="CATALOG" />; }
