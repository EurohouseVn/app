import { redirect } from 'next/navigation';

export default function LegacyFormulaAccessPage() {
  redirect('/eurohouse-access?featureKey=FORMULA_CUTTING');
}
