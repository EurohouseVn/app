'use client';

import { useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { QuotationInput, QuotationResult } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiSend } from '../../src/lib/api';
import {
  currency,
  eyebrowStyle,
  inputStyle,
  labelStyle,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  primaryButtonStyle,
  subtitleStyle,
} from '../../src/ui';

type FormState = Omit<QuotationInput, 'customerName' | 'doorType'> & { customerName: string; doorType: string };

const initial: FormState = {
  customerName: '',
  doorType: 'Cửa đi mở quay 2 cánh',
  widthMm: 1200,
  heightMm: 2200,
  quantity: 1,
  pricePerM2: 2_600_000,
  aluPricePerKg: 92_000,
  glassPerM2: 320_000,
  accessoryCost: 1_500_000,
  laborCost: 800_000,
  installCost: 500_000,
  profitPct: 15,
  depreciation: 200_000,
};

const numberFields: { key: keyof FormState; label: string; suffix?: string }[] = [
  { key: 'widthMm', label: 'Rộng (mm)' },
  { key: 'heightMm', label: 'Cao (mm)' },
  { key: 'quantity', label: 'Số bộ' },
  { key: 'pricePerM2', label: 'Đơn giá / m²', suffix: 'đ' },
  { key: 'accessoryCost', label: 'Phụ kiện', suffix: 'đ' },
  { key: 'laborCost', label: 'Nhân công', suffix: 'đ' },
  { key: 'installCost', label: 'Lắp đặt', suffix: 'đ' },
  { key: 'depreciation', label: 'Khấu hao', suffix: 'đ' },
  { key: 'profitPct', label: 'Lợi nhuận (%)' },
];

export default function QuotePage() {
  const [form, setForm] = useState<FormState>(initial);
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'customerName' || key === 'doorType' ? value : Number(value) || 0,
    }));
  }

  async function calculate() {
    setError('');
    setLoading(true);
    try {
      const data = await apiSend<QuotationResult>('/quotations/calc', 'POST', form);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tính được báo giá.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>BÁO GIÁ</p>
      <h1 style={pageTitleStyle}>Tính báo giá nhanh</h1>
      <p style={subtitleStyle}>Nhập kích thước và đơn giá, hệ thống tính diện tích, chi phí và lợi nhuận tự động.</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginTop: 12, alignItems: 'start' }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Thông số</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Khách hàng
              <input style={inputStyle} value={form.customerName} placeholder="Tên khách (tuỳ chọn)" onChange={(e) => update('customerName', e.target.value)} />
            </label>
            <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
              Loại cửa
              <input style={inputStyle} value={form.doorType} onChange={(e) => update('doorType', e.target.value)} />
            </label>
            {numberFields.map((field) => (
              <label key={field.key} style={labelStyle}>
                {field.label}
                {field.suffix ? <span style={{ color: colors.brandGrey }}> ({field.suffix})</span> : null}
                <input
                  style={inputStyle}
                  type="number"
                  value={String(form[field.key] as number)}
                  onChange={(e) => update(field.key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <button onClick={calculate} disabled={loading} style={{ ...primaryButtonStyle, marginTop: 18, width: '100%' }}>
            {loading ? 'Đang tính...' : 'Tính báo giá'}
          </button>
        </div>

        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Kết quả</h2>
          {result ? (
            <>
              <ResultRow label="Diện tích" value={`${result.areaM2} m²`} />
              <ResultRow label="Tiền nhôm/kính (theo m²)" value={currency(result.baseAmount)} />
              <ResultRow label="Phụ kiện" value={currency(result.accessoryCost)} />
              <ResultRow label="Nhân công" value={currency(result.laborCost)} />
              <ResultRow label="Lắp đặt" value={currency(result.installCost)} />
              <ResultRow label="Khấu hao" value={currency(result.depreciation)} />
              <ResultRow label={`Lợi nhuận (${form.profitPct}%)`} value={currency(result.profitAmount)} />
              <div style={{ background: colors.brandOrange, borderRadius: 16, padding: 18, marginTop: 16, textAlign: 'center' }}>
                <small style={{ color: colors.brandBlack, fontWeight: 700, opacity: 0.8 }}>TỔNG BÁO GIÁ · {form.quantity} BỘ</small>
                <strong style={{ display: 'block', color: colors.brandBlack, fontSize: 30, marginTop: 4 }}>{currency(result.totalAmount)}</strong>
              </div>
            </>
          ) : (
            <p style={{ color: colors.brandGrey }}>Nhập thông số rồi bấm “Tính báo giá”.</p>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${colors.orangeSoft}` }}>
      <span style={{ color: colors.brandBlack }}>{label}</span>
      <strong style={{ color: colors.brandBlack }}>{value}</strong>
    </div>
  );
}
