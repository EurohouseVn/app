
'use client';
import { NppPage } from '../../../src/NppPage';
import { QuotationForm } from '../../../src/components/QuotationForm';
import { useParams } from 'next/navigation';

export default function EditQuotationPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  
  return (
    <NppPage>
      <QuotationForm initialId={id} />
    </NppPage>
  );
}
