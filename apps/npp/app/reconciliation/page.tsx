'use client';

import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import type { NppFactoryReconciliation } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const statusCols = ['NEW', 'RECEIVED_BY_NPP', 'SENT_TO_ADMIN', 'PROCESSING', 'COMPLETED', 'CANCELLED'];
const statusLabel: Record<string, string> = {
  NEW: 'Mới',
  RECEIVED_BY_NPP: 'Đã tiếp nhận',
  SENT_TO_ADMIN: 'Đã gửi',
  PROCESSING: 'Đang xử lý',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

function monthOptions(): { key: string; label: string }[] {
  const now = new Date();
  const opts: { key: string; label: string }[] = [];
  for (let i = 0; i < 6; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    opts.push({ key, label: `Tháng ${d.getMonth() + 1}/${d.getFullYear()}` });
  }
  return opts;
}

export default function ReconciliationPage() {
  const [rows, setRows] = useState<NppFactoryReconciliation[]>([]);
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');
  const months = monthOptions();

  useEffect(() => {
    const query = month ? `?month=${month}` : '';
    apiGet<NppFactoryReconciliation[]>(`/npp/orders/reconciliation${query}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được đối chiếu.'));
  }, [month]);

  return (
    <NppPage>
      <p style={eyebrowStyle}>ĐỐI CHIẾU</p>
      <h1 style={pageTitleStyle}>Đối chiếu số liệu đơn hàng theo Xưởng</h1>
      <p style={subtitleStyle}>So sánh số lượng đơn theo từng trạng thái và tổng giá trị của mỗi Xưởng.</p>
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 20px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setMonth('')}
          style={{ ...ghostButtonStyle, background: month === '' ? ui.brandSoft : ui.surface, color: month === '' ? ui.brandText : ui.text, borderColor: month === '' ? ui.brand : ui.borderStrong }}
        >
          Toàn thời gian
        </button>
        {months.map((m) => (
          <button
            key={m.key}
            onClick={() => setMonth(m.key)}
            style={{ ...ghostButtonStyle, background: month === m.key ? ui.brandSoft : ui.surface, color: month === m.key ? ui.brandText : ui.text, borderColor: month === m.key ? ui.brand : ui.borderStrong }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ ...panelStyle, padding: 0 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeadStyle}>Xưởng</th>
                {statusCols.map((s) => (
                  <th key={s} style={tableHeadStyle}>{statusLabel[s]}</th>
                ))}
                <th style={tableHeadStyle}>Tổng kg</th>
                <th style={tableHeadStyle}>Tổng giá trị</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.factoryOrgId ?? row.factoryName}>
                  <td style={{ ...tableCellStyle, fontWeight: 700 }}>{row.factoryName}</td>
                  {statusCols.map((s) => (
                    <td key={s} style={tableCellStyle}>{row.counts[s] ?? 0}</td>
                  ))}
                  <td style={tableCellStyle}>{row.totalKg.toFixed(1)} kg</td>
                  <td style={tableCellStyle}>{currency(row.totalAmount)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={statusCols.length + 3} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>
                    <Scale size={16} style={{ verticalAlign: -2, marginRight: 6 }} /> Chưa có dữ liệu đơn hàng trong kỳ này.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </NppPage>
  );
}
