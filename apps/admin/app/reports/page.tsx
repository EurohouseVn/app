'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileBarChart } from 'lucide-react';
import type { FinancialReportData } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet } from '../../src/lib/api';
import {
  currency,
  eyebrowStyle,
  ghostButtonStyle,
  millions,
  pageTitleStyle,
  panelStyle,
  panelTitleStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
  ui,
} from '../../src/ui';

export default function ReportsPage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<FinancialReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<FinancialReportData>(`/reports/pnl?months=${months}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được báo cáo.'));
  }, [months]);

  const maxRevenue = useMemo(() => Math.max(...(data?.months.map((m) => Math.max(m.revenue, m.directMaterialCost + m.overheadCost)) ?? [1]), 1), [data]);

  return (
    <AdminPage>
      <p style={eyebrowStyle}>BÁO CÁO TÀI CHÍNH</p>
      <h1 style={pageTitleStyle}>Báo cáo lợi nhuận theo tháng</h1>
      <p style={subtitleStyle}>Doanh thu từ đơn hàng, chi phí từ phiếu chi (vật liệu trực tiếp + chi phí sản xuất chung).</p>
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 20px' }}>
        {[3, 6, 12].map((n) => (
          <button
            key={n}
            onClick={() => setMonths(n)}
            style={{ ...ghostButtonStyle, background: months === n ? ui.brandSoft : ui.surface, color: months === n ? ui.brandText : ui.text, borderColor: months === n ? ui.brand : ui.borderStrong }}
          >
            {n} tháng gần nhất
          </button>
        ))}
      </div>

      {data ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ ...panelStyle, padding: 18 }}>
              <small style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Tổng doanh thu</small>
              <strong style={{ display: 'block', fontSize: 22, color: ui.text, marginTop: 6 }}>{currency(data.totalRevenue)}</strong>
            </div>
            <div style={{ ...panelStyle, padding: 18 }}>
              <small style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Tổng chi phí</small>
              <strong style={{ display: 'block', fontSize: 22, color: ui.text, marginTop: 6 }}>{currency(data.totalCost)}</strong>
            </div>
            <div style={{ ...panelStyle, padding: 18 }}>
              <small style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Tổng lợi nhuận</small>
              <strong style={{ display: 'block', fontSize: 22, color: data.totalProfit >= 0 ? ui.success : ui.danger, marginTop: 6 }}>{currency(data.totalProfit)}</strong>
            </div>
          </div>

          <div style={{ ...panelStyle, marginBottom: 20 }}>
            <h2 style={panelTitleStyle}>
              <FileBarChart size={16} style={{ verticalAlign: -2, marginRight: 8 }} color={ui.textMuted} />
              Doanh thu vs chi phí theo tháng
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 160 }}>
              {data.months.map((m) => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 130 }}>
                    <div style={{ width: 14, borderRadius: 4, background: ui.brand, height: `${Math.max(4, (m.revenue / maxRevenue) * 130)}px` }} title={`Doanh thu: ${currency(m.revenue)}`} />
                    <div style={{ width: 14, borderRadius: 4, background: ui.danger, height: `${Math.max(4, ((m.directMaterialCost + m.overheadCost) / maxRevenue) * 130)}px` }} title={`Chi phí: ${currency(m.directMaterialCost + m.overheadCost)}`} />
                  </div>
                  <small style={{ color: ui.textFaint, fontSize: 11 }}>{m.month.slice(5)}/{m.month.slice(0, 4)}</small>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: ui.textMuted }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ui.brand, marginRight: 6 }} />Doanh thu</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: ui.danger, marginRight: 6 }} />Chi phí</span>
            </div>
          </div>

          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Tháng', 'Doanh thu', 'Chi phí NVL trực tiếp', 'Chi phí SXC', 'Lợi nhuận', 'Tỷ suất LN'].map((head) => (
                      <th key={head} style={tableHeadStyle}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{m.month}</td>
                      <td style={tableCellStyle}>{millions(m.revenue)}</td>
                      <td style={tableCellStyle}>{millions(m.directMaterialCost)}</td>
                      <td style={tableCellStyle}>{millions(m.overheadCost)}</td>
                      <td style={{ ...tableCellStyle, color: m.profit >= 0 ? ui.success : ui.danger, fontWeight: 700 }}>{millions(m.profit)}</td>
                      <td style={tableCellStyle}>{m.profitPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </AdminPage>
  );
}
