'use client';

import { useState } from 'react';
import { Calculator, FileText, Receipt, Save } from 'lucide-react';
import type { QuotationInput, QuotationRecord, QuotationResult } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiSend, openAuthedFile } from '../../src/lib/api';
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
  ui,
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
  const [saved, setSaved] = useState<QuotationRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'customerName' || key === 'doorType' ? value : Number(value) || 0,
    }));
    setSaved(null);
  }

  async function calculate() {
    setError('');
    setLoading(true);
    setSaved(null);
    try {
      const data = await apiSend<QuotationResult>('/quotations/calc', 'POST', form);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tính được báo giá.');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setError('');
    setSaving(true);
    try {
      const record = await apiSend<QuotationRecord>('/quotations', 'POST', form);
      setSaved(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được báo giá.');
    } finally {
      setSaving(false);
    }
  }

  async function exportPdf() {
    if (!saved) return;
    setError('');
    try {
      await openAuthedFile(`/quotations/${saved.id}/pdf`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất được PDF.');
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>BÁO GIÁ</p>
      <h1 style={pageTitleStyle}>Tính báo giá nhanh</h1>
      <p style={subtitleStyle}>Nhập kích thước và đơn giá, hệ thống tính diện tích, chi phí và lợi nhuận tự động.</p>
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginTop: 12, alignItems: 'start' }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>
            <Calculator size={16} style={{ verticalAlign: -2, marginRight: 8 }} color={ui.textMuted} />
            Thông số
          </h2>
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
                {field.suffix ? <span style={{ color: ui.textFaint, fontWeight: 400 }}> ({field.suffix})</span> : null}
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
          <h2 style={panelTitleStyle}>
            <Receipt size={16} style={{ verticalAlign: -2, marginRight: 8 }} color={ui.textMuted} />
            Kết quả
          </h2>
          {result ? (
            <>
              <ResultRow label="Diện tích" value={`${result.areaM2} m²`} />
              <ResultRow label="Tiền nhôm/kính (theo m²)" value={currency(result.baseAmount)} />
              <ResultRow label="Phụ kiện" value={currency(result.accessoryCost)} />
              <ResultRow label="Nhân công" value={currency(result.laborCost)} />
              <ResultRow label="Lắp đặt" value={currency(result.installCost)} />
              <ResultRow label="Khấu hao" value={currency(result.depreciation)} />
              <ResultRow label={`Lợi nhuận (${form.profitPct}%)`} value={currency(result.profitAmount)} />
              <div style={{ background: ui.brandSoft, border: `1px solid ${ui.brand}22`, borderRadius: 14, padding: 18, marginTop: 16, textAlign: 'center' }}>
                <small style={{ color: ui.brandText, fontWeight: 700 }}>TỔNG BÁO GIÁ · {form.quantity} BỘ</small>
                <strong style={{ display: 'block', color: ui.text, fontSize: 28, marginTop: 4 }}>{currency(result.totalAmount)}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button
                  onClick={save}
                  disabled={saving}
                  style={{ ...primaryButtonStyle, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu báo giá'}
                </button>
                <button
                  onClick={exportPdf}
                  disabled={!saved}
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: `1px solid ${ui.borderStrong}`,
                    background: saved ? ui.surface : ui.surfaceMuted,
                    color: saved ? ui.text : ui.textFaint,
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: saved ? 'pointer' : 'not-allowed',
                  }}
                >
                  <FileText size={16} /> Xuất PDF
                </button>
              </div>
              {saved ? (
                <p style={{ color: ui.success, fontWeight: 700, fontSize: 13, marginTop: 10, textAlign: 'center' }}>
                  Đã lưu báo giá {saved.code}. Bấm "Xuất PDF" để tải file gửi khách.
                </p>
              ) : null}
            </>
          ) : (
            <p style={{ color: ui.textFaint, fontSize: 14 }}>Nhập thông số rồi bấm "Tính báo giá".</p>
          )}
        </div>
      </div>
    </AdminPage>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 14 }}>
      <span style={{ color: ui.textMuted }}>{label}</span>
      <strong style={{ color: ui.text }}>{value}</strong>
    </div>
  );
}
