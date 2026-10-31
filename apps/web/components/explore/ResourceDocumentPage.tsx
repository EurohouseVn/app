import { PageIntro } from '@/components/PageIntro';
import { DocumentGroups } from './DocumentGroups';
import { listPublicDocuments } from '@/lib/public-api';

export async function ResourceDocumentPage({ title, summary, type }: { title: string; summary: string; type: string }) {
  let documents: PublicDocumentProjection[] = [];
  try { documents = await listPublicDocuments({ type }); } catch { documents = []; }
  return <><PageIntro eyebrow="TÀI NGUYÊN ĐƯỢC DUYỆT" title={title} summary={summary} breadcrumbs={[{ label: 'Tài nguyên', href: '/tai-nguyen' }, { label: title }]} />
    <section className="home-section resource-document-page"><div className="container"><header className="library-result-heading"><p className="home-eyebrow">Phiên bản công khai</p><h2>{documents.length} tài liệu có hiệu lực</h2><p>Kiểm tra revision và ngày hiệu lực trước khi sử dụng.</p></header><DocumentGroups documents={documents} /></div></section>
  </>;
}
import type { PublicDocumentProjection } from '@eurohouse/types';
