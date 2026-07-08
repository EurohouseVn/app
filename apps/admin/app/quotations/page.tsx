'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Receipt } from 'lucide-react';
import type { QuotationRecord } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, openAuthedFile } from '../../src/lib/api';
import { currency, eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

export default function QuotationsPage() {
  const [items, setItems] = useState<QuotationRecord[]>([]);
  const [selected, setSelected] = useState<QuotationRecord | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    apiGet<QuotationRecord[]>('/quotations')
      .then((data) => {
        setItems(data);
        setSelected((current) => (current ? data.find((q) => q.id === current.id) ?? data[0] ?? null : data[0] ?? null));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Không tải được báo giá'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function exportPdf(quotation: QuotationRecord) {
    setMessage('');
    try {
      await openAuthedFile(`/quotations/${quotation.id}/pdf`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không xuất được PDF');
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>BÁO GIÁ</p>
      <h1 style={pageTitleStyle}>Báo giá đã lưu</h1>
      <p style={subtitleStyle}>Danh sách các báo giá đã tạo. Chọn một báo giá để xem chi tiết và xuất PDF.</p>
      {message ? <p style={{ color: ui.danger, fontWeight: 700, fontSize: 13 }}>{message}</p> : null}

      {items.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 16, textAlign: 'center', padding: 48, color: ui.textFaint }}>
          Chưa có báo giá nào. Tạo báo giá mới ở trang "Báo giá".
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 16, alignItems: 'start' }}>
          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Mã', 'Khách hàng', 'Loại cửa', 'Tổng tiền', 'Ngày'].map((head) => (
                      <th key={head} style={tableHeadStyle}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => setSelected(q)}
                      style={{ cursor: 'pointer', background: selected?.id === q.id ? ui.brandSoft : 'transparent' }}
                    >
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{q.code}</td>
                      <td style={tableCellStyle}>{q.customerName || '—'}</td>
                      <td style={tableCellStyle}>{q.doorType || '—'}</td>
                      <td style={tableCellStyle}>{(q.totalAmount / 1000000).toFixed(1)} tr</td>
                      <td style={tableCellStyle}>{new Date(q.createdAt).toLocaleDateString('vi-VN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panelStyle}>
            {selected ? (
              <>
                <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Receipt size={18} color={ui.brand} /> {selected.code}
                </h2>
                <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>
                  {selected.customerName || '—'} · {selected.doorType || '—'}
                </p>
                <p style={{ margin: '4px 0 16px', color: ui.textFaint, fontSize: 13 }}>
                  {selected.widthMm} × {selected.heightMm} mm · {selected.quantity} bộ
                </p>

                <DetailRow label={`Diện tích (${selected.areaM2} m²)`} value={currency(selected.baseAmount)} />
                <DetailRow label="Phụ kiện" value={currency(selected.accessoryCost)} />
                <DetailRow label="Nhân công" value={currency(selected.laborCost)} />
                <DetailRow label="Lắp đặt" value={currency(selected.installCost)} />
                <DetailRow label="Khấu hao" value={currency(selected.depreciation)} />
                <DetailRow label={`Lợi nhuận (${selected.profitPct}%)`} value={currency(selected.profitAmount)} />

                <div style={{ background: ui.brandSoft, border: `1px solid ${ui.brand}22`, borderRadius: 14, padding: 16, marginTop: 16, textAlign: 'center' }}>
                  <small style={{ color: ui.brandText, fontWeight: 700 }}>TỔNG BÁO GIÁ</small>
                  <strong style={{ display: 'block', color: ui.text, fontSize: 24, marginTop: 4 }}>{currency(selected.totalAmount)}</strong>
                </div>

                <button
                  onClick={() => exportPdf(selected)}
                  style={{
                    marginTop: 16,
                    width: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    border: `1px solid ${ui.borderStrong}`,
                    background: ui.surface,
                    color: ui.text,
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={16} /> Xuất PDF
                </button>
              </>
            ) : (
              <p style={{ color: ui.textFaint }}>Chọn một báo giá để xem chi tiết.</p>
            )}
          </div>
        </div>
      )}
    </AdminPage>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 14 }}>
      <span style={{ color: ui.textMuted }}>{label}</span>
      <strong style={{ color: ui.text }}>{value}</strong>
    </div>
  );
}
