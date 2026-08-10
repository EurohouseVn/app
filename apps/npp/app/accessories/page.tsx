'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Save, Search } from 'lucide-react';
import type { NppAccessoryItem, UpsertNppAccessoryInput } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const emptyForm: UpsertNppAccessoryInput = {
  name: '',
  brand: '',
  category: '',
  unit: 'cai',
  quantity: 0,
  unitCost: 0,
  note: '',
};

export default function NppAccessoriesPage() {
  const [items, setItems] = useState<NppAccessoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<UpsertNppAccessoryInput>(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<NppAccessoryItem[]>(`/npp/accessories${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Khong tai duoc phu kien.'));
  }

  useEffect(() => { load(); }, []);

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), [items]);

  function updateForm(key: keyof UpsertNppAccessoryInput, value: string) {
    setForm((current) => ({
      ...current,
      [key]: key === 'quantity' || key === 'unitCost' ? Number(value) : value,
    }));
  }

  async function createItem() {
    setError('');
    setMessage('');
    try {
      await apiSend('/npp/accessories', 'POST', form);
      setMessage('Da them phu kien vao database mini cua NPP.');
      setForm(emptyForm);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong luu duoc phu kien.');
    }
  }

  async function quickUpdate(item: NppAccessoryItem, quantity: number) {
    setError('');
    try {
      await apiSend(`/npp/accessories/${item.id}`, 'PATCH', { quantity });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Khong cap nhat duoc so luong.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Phu kien</p>
      <h1 style={pageTitleStyle}>Database phu kien cua NPP</h1>
      <p style={subtitleStyle}>Quan ly phu kien doc lap voi WebAdmin. Co the nhap tay, tim theo hang/loai/ten; doc hoa don Gmail/Gemini se gan vao module nay o buoc tich hop connector.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.35fr', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><PackagePlus size={18} color={ui.brand} /> Them phu kien</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Ten phu kien<input style={inputStyle} value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="Ban le, khoa, ray truot..." /></label>
            <label style={labelStyle}>Hang<input style={inputStyle} value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} placeholder="Kinlong, Hafele, Eurohouse..." /></label>
            <label style={labelStyle}>Loai<input style={inputStyle} value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="Khoa / ban le / keo / silicon" /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Don vi<input style={inputStyle} value={form.unit} onChange={(e) => updateForm('unit', e.target.value)} placeholder="cai" /></label>
              <label style={labelStyle}>So luong<input style={inputStyle} type="number" value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} /></label>
              <label style={labelStyle}>Gia nhap<input style={inputStyle} type="number" value={form.unitCost} onChange={(e) => updateForm('unitCost', e.target.value)} /></label>
            </div>
            <label style={labelStyle}>Ghi chu<input style={inputStyle} value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="Ma hoa don, nha cung cap, quy cach" /></label>
            <button onClick={createItem} style={primaryButtonStyle}><Save size={15} /> Luu phu kien</button>
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0 }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ color: ui.textMuted, fontSize: 14 }}>Tong gia tri: <strong style={{ color: ui.text }}>{currency(totalValue)}</strong></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, width: 260 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tim ten, hang, loai" />
              <button onClick={load} style={ghostButtonStyle}><Search size={14} /> Tim</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Ten', 'Hang', 'Loai', 'Ton', 'Gia nhap', 'Gia tri', 'Cap nhat'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{item.name}</td>
                    <td style={tableCellStyle}>{item.brand || '-'}</td>
                    <td style={tableCellStyle}>{item.category || '-'}</td>
                    <td style={tableCellStyle}>{item.quantity.toLocaleString('vi-VN')} {item.unit}</td>
                    <td style={tableCellStyle}>{currency(item.unitCost)}</td>
                    <td style={tableCellStyle}>{currency(item.quantity * item.unitCost)}</td>
                    <td style={tableCellStyle}><input style={{ ...inputStyle, width: 90 }} type="number" defaultValue={item.quantity} onBlur={(e) => quickUpdate(item, Number(e.target.value))} /></td>
                  </tr>
                ))}
                {items.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chua co phu kien.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </NppPage>
  );
}
