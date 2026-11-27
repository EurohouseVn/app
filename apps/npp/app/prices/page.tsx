'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { NppColorPriceItem } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, inputStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

export default function NppPricesPage() {
  const [rows, setRows] = useState<NppColorPriceItem[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { apiGet<NppColorPriceItem[]>('/npp/color-prices').then(setRows).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được bảng giá.')); }, []);

  function edit(code: string, key: 'bundlePricePerKg' | 'barePricePerKg', value: string) {
    setRows((cur) => cur.map((r) => (r.colorCode === code ? { ...r, [key]: Number(value) } : r)));
  }

  async function save() {
    setMessage(''); setError('');
    try {
      const saved = await apiSend<NppColorPriceItem[]>('/npp/color-prices', 'PUT', { prices: rows.map(({ colorCode, bundlePricePerKg, barePricePerKg }) => ({ colorCode, bundlePricePerKg, barePricePerKg })) });
      setRows(saved);
      setMessage('Đã lưu bảng giá. Khi cân đơn, giá mỗi màu tự điền theo bảng này.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được bảng giá.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Bảng giá</p>
      <h1 style={pageTitleStyle}>Giá niêm yết theo màu nhôm</h1>
      <p style={subtitleStyle}>Mỗi màu có giá riêng. Trong một màu tách hai dòng giá do nhà phân phối tự thiết lập: giá theo bó nguyên (chưa bóc vỏ nilon) và giá theo nhôm trần (không gồm vỏ).</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}
      <section style={{ ...panelStyle, padding: 0, marginTop: 16, maxWidth: 860 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['Màu nhôm', 'Giá bó nguyên (đ/kg)', 'Giá nhôm trần (đ/kg)'].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.colorCode}>
                <td style={{ ...tableCellStyle, fontWeight: 800 }}>{r.colorName}</td>
                <td style={tableCellStyle}><input aria-label={`Giá bó nguyên ${r.colorName}`} style={{ ...inputStyle, width: 170 }} type="number" min="0" step="500" value={r.bundlePricePerKg} onChange={(e) => edit(r.colorCode, 'bundlePricePerKg', e.target.value)} /></td>
                <td style={tableCellStyle}><input aria-label={`Giá nhôm trần ${r.colorName}`} style={{ ...inputStyle, width: 170 }} type="number" min="0" step="500" value={r.barePricePerKg} onChange={(e) => edit(r.colorCode, 'barePricePerKg', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: 16, borderTop: `1px solid ${ui.border}` }}><button style={primaryButtonStyle} onClick={save}><Save size={15} /> Lưu bảng giá</button></div>
      </section>
    </NppPage>
  );
}
