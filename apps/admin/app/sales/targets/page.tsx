'use client';
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, subtitleStyle, ghostButtonStyle } from '../../../src/ui';

interface SalesTarget {
  nppId: string;
  nppName: string;
  province: string;
  targetKg: number;
  actualKg: number;
  percent: number;
}

export default function SalesTargetsPage() {
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    fetchTargets();
  }, [year, month]);

  async function fetchTargets() {
    setLoading(true);
    try {
      const data = await apiGet<SalesTarget[]>(`/admin/sales/targets?year=${year}&month=${month}`);
      setTargets(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitleStyle}>Theo dõi doanh số NPP</h1>
          <p style={subtitleStyle}>Báo cáo sản lượng theo tháng (Kg)</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${ui.border}`, outline: 'none' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i+1} value={i+1}>Tháng {i+1}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${ui.border}`, outline: 'none' }}>
            {[2025, 2026, 2027].map(y => (
              <option key={y} value={y}>Năm {y}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Nhà Phân Phối</th>
              <th style={tableHeadStyle}>Khu vực</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Chỉ tiêu (Kg)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thực đạt (Kg)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Tiến độ (%)</th>
              <th style={tableHeadStyle}>Thanh tiến độ</th>
            </tr>
          </thead>
          <tbody>
            {loading && targets.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</td></tr>
            ) : targets.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Không có dữ liệu nhà phân phối trong khu vực của bạn.</td></tr>
            ) : targets.map((t) => (
              <tr key={t.nppId}>
                <td style={{ ...tableCellStyle, fontWeight: 600, color: ui.brandText }}>{t.nppName}</td>
                <td style={tableCellStyle}>{t.province || '-'}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600 }}>{t.targetKg.toLocaleString('vi-VN')}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700, color: ui.blue }}>{t.actualKg.toLocaleString('vi-VN')}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 600, color: t.percent >= 100 ? ui.success : t.percent >= 50 ? ui.warning : ui.danger }}>
                  {t.percent.toFixed(1)}%
                </td>
                <td style={{ ...tableCellStyle, width: 200 }}>
                  <div style={{ width: '100%', height: 8, background: ui.surfaceMuted, borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(t.percent, 100)}%`, height: '100%', background: t.percent >= 100 ? ui.success : t.percent >= 50 ? ui.warning : ui.danger, transition: 'width 0.5s ease' }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
