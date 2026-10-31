import { Download, FileText } from 'lucide-react';
import type { PublicDocumentProjection } from '@eurohouse/types';
import { EmptyState } from '@/components/EmptyState';
import { groupDocumentsByType } from '@/lib/explore-content';

export function DocumentGroups({ documents }: { documents: readonly PublicDocumentProjection[] }) {
  if (!documents.length) return <EmptyState title="Tài liệu đang được cập nhật" message="Tệp chỉ xuất hiện khi đã có phiên bản, ngày hiệu lực và quyền công khai." action={{ label: 'Liên hệ xác nhận tài liệu', href: '/lien-he' }} />;
  return <div className="document-groups">{groupDocumentsByType(documents).map((group) => <section key={group.type}><header><FileText size={21} aria-hidden="true" /><h2>{documentTypeLabel(group.type)}</h2></header><div>{group.documents.map((document) => <a href={document.downloadUrl} key={document.id} target="_blank" rel="noreferrer"><span><strong>{document.title}</strong><small>Phiên bản {document.revisionLabel} · Hiệu lực {formatDate(document.effectiveDate)}</small></span><Download size={18} aria-hidden="true" /></a>)}</div></section>)}</div>;
}

function documentTypeLabel(type: string) { return ({ CATALOG: 'Catalog', PROFILE: 'Hồ sơ năng lực', TECHNICAL: 'Tài liệu kỹ thuật' } as Record<string, string>)[type] || type; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('vi-VN').format(date); }
