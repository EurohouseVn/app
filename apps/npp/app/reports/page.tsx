'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileBarChart } from 'lucide-react';
import type { NppFinancialReportData } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
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

export default function NppReportsPage() {
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<NppFinancialReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<NppFinancialReportData>(`/npp/reports/pnl?months=${months}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được báo cáo.'));
  }, [months]);

  const maxRevenue = useMemo(() => Math.max(...(data?.months.map((m) => m.revenue) ?? [1]), 1), [data]);

  return (
    <NppPage>
      <p style={eyebrowStyle}>BÁO CÁO TÀI CHÍNH</p>
      <h1 style={pageTitleStyle}>Doanh thu & công nợ theo tháng</h1>
      <p style={subtitleStyle}>Doanh thu từ đơn hàng của NPP và công nợ phát sinh/thu được theo từng tháng.</p>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ ...panelStyle, padding: 18 }}>
              <small style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Tổng doanh thu</small>
              <strong style={{ display: 'block', fontSize: 22, color: ui.text, marginTop: 6 }}>{currency(data.totalRevenue)}</strong>
            </div>
            <div style={{ ...panelStyle, padding: 18 }}>
              <small style={{ display: 'block', color: ui.textMuted, fontSize: 12 }}>Công nợ còn mở</small>
              <strong style={{ display: 'block', fontSize: 22, color: ui.danger, marginTop: 6 }}>{currency(data.totalDebtOpen)}</strong>
            </div>
          </div>

          <div style={{ ...panelStyle, marginBottom: 20 }}>
            <h2 style={panelTitleStyle}>
              <FileBarChart size={16} style={{ verticalAlign: -2, marginRight: 8 }} color={ui.textMuted} />
              Doanh thu theo tháng
            </h2>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', height: 160 }}>
              {data.months.map((m) => (
                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{ width: 20, borderRadius: 4, background: `linear-gradient(180deg, ${ui.brand}, ${ui.brandSoft})`, height: `${Math.max(4, (m.revenue / maxRevenue) * 130)}px` }}
                    title={`Doanh thu: ${currency(m.revenue)}`}
                  />
                  <small style={{ color: ui.textFaint, fontSize: 11 }}>{m.month.slice(5)}/{m.month.slice(0, 4)}</small>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Tháng', 'Doanh thu', 'Công nợ phát sinh', 'Công nợ đã thu'].map((head) => (
                      <th key={head} style={tableHeadStyle}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.months.map((m) => (
                    <tr key={m.month}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{m.month}</td>
                      <td style={tableCellStyle}>{millions(m.revenue)}</td>
                      <td style={tableCellStyle}>{millions(m.debtCreated)}</td>
                      <td style={tableCellStyle}>{millions(m.debtPaid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </NppPage>
  );
}
