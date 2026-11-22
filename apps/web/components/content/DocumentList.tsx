import type { PublicDocumentProjection } from '@eurohouse/types';
import { Download } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function DocumentList({ documents = [] }: { documents?: readonly PublicDocumentProjection[] }) {
  if (documents.length === 0) return <EmptyState title="Chưa tìm thấy tài liệu ở mục này" message="Mở trung tâm tài nguyên để xem catalog, bản vẽ và hướng dẫn đang có, hoặc liên hệ EUROHOUSE nếu bạn cần một tài liệu cụ thể." action={{ label: 'Mở trung tâm tài nguyên', href: '/tai-nguyen' }} />;
  return <div className="document-list">{documents.map((document) => <a href={document.downloadUrl} key={document.id}><span><strong>{document.title}</strong><small>{document.revisionLabel} · Hiệu lực {document.effectiveDate}</small></span><Download size={18} aria-hidden="true" /></a>)}</div>;
}
