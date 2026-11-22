import type { Metadata } from 'next';
import { ResourceDocumentPage } from '@/components/explore/ResourceDocumentPage';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Hồ sơ năng lực', description: 'Hồ sơ năng lực chính thức giới thiệu sản phẩm và khả năng phục vụ của EUROHOUSE.', alternates: { canonical: '/tai-nguyen/profile' } };
export default function ProfilePage() { return <ResourceDocumentPage title="Hồ sơ năng lực" summary="Tổng quan doanh nghiệp và phạm vi phục vụ chỉ hiển thị từ hồ sơ đã được duyệt." type="PROFILE" />; }
