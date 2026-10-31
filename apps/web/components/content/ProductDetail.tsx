import Image from 'next/image';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import type { ResidentialItem } from '@/lib/residential-content';
import { ConsultationCta } from './ConsultationCta';
import { DocumentList } from './DocumentList';
import { SpecificationTable } from './SpecificationTable';

export function ProductDetail({ item, parentLabel, parentHref }: { item: ResidentialItem; parentLabel: string; parentHref: string }) {
  const rows = [{ label: 'Nhóm nội dung', value: item.eyebrow }, ...(item.code ? [{ label: 'Mã nhận diện', value: item.code }] : []), { label: 'Ứng dụng', value: item.applications.join(', ') }];
  return <>
    <section className="residential-detail-hero"><div className="container"><Breadcrumbs items={[{ label: 'Nhôm dân dụng', href: '/nhom-dan-dung' }, { label: parentLabel, href: parentHref }, { label: item.title }]} /><div className="residential-detail-grid"><div><p className="home-eyebrow">{item.eyebrow}</p><h1>{item.title}</h1><p>{item.summary}</p></div>{item.image ? <div className="residential-detail-image"><Image src={item.image} alt={`${item.title} EUROHOUSE`} fill unoptimized sizes="(max-width: 760px) 100vw, 48vw" /></div> : null}</div></div></section>
    <section className="home-section residential-detail-body"><div className="container residential-body-grid"><article><h2>Tổng quan</h2><p>{item.description}</p><h2>Ứng dụng phù hợp</h2><ul>{item.applications.map((application) => <li key={application}>{application}</li>)}</ul></article><aside><SpecificationTable rows={rows} /></aside></div></section>
    <section className="home-section residential-documents"><div className="container"><div className="home-section-heading"><p className="home-eyebrow">Tài liệu</p><h2>Hồ sơ kỹ thuật và phiên bản công bố.</h2></div><DocumentList /></div></section>
    <ConsultationCta title={`Cần tư vấn ${item.title}?`} />
  </>;
}
