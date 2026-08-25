'use client';

import { useEffect, useMemo, useState } from 'react';
import { Layers3, Plus, Save, Scissors } from 'lucide-react';
import type { GlassCutPieceInput, GlassCutPlanResult, NppGlassSheetItem, UpsertNppGlassSheetInput } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const emptySheet: UpsertNppGlassSheetInput = {
  code: '',
  glassType: '',
  widthMm: 2440,
  heightMm: 3660,
  quantity: 1,
  unitCost: 0,
  note: '',
};

export default function NppGlassPage() {
  const [sheets, setSheets] = useState<NppGlassSheetItem[]>([]);
  const [sheetForm, setSheetForm] = useState<UpsertNppGlassSheetInput>(emptySheet);
  const [selectedSheetId, setSelectedSheetId] = useState('');
  const [pieces, setPieces] = useState<GlassCutPieceInput[]>([{ widthMm: 600, heightMm: 900, quantity: 1 }]);
  const [plan, setPlan] = useState<GlassCutPlanResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<NppGlassSheetItem[]>('/npp/glass/sheets')
      .then((items) => {
        setSheets(items);
        setSelectedSheetId((current) => current || items[0]?.id || '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được kho kính.'));
  }

  useEffect(() => { load(); }, []);

  const selectedSheet = sheets.find((sheet) => sheet.id === selectedSheetId);
  const totalValue = useMemo(() => sheets.reduce((sum, sheet) => sum + sheet.quantity * sheet.unitCost, 0), [sheets]);

  function updateSheet(key: keyof UpsertNppGlassSheetInput, value: string) {
    setSheetForm((current) => ({
      ...current,
      [key]: key === 'widthMm' || key === 'heightMm' || key === 'quantity' || key === 'unitCost' ? Number(value) : value,
    }));
  }

  function updatePiece(index: number, key: keyof GlassCutPieceInput, value: string) {
    setPieces((current) => current.map((piece, i) => i === index ? { ...piece, [key]: Number(value) } : piece));
  }

  async function createSheet() {
    setError('');
    setMessage('');
    try {
      await apiSend('/npp/glass/sheets', 'POST', sheetForm);
      setMessage('Da them tam kinh dau vao.');
      setSheetForm(emptySheet);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được tấm kính.');
    }
  }

  async function calculatePlan() {
    setError('');
    setPlan(null);
    if (!selectedSheetId) {
      setError('Chon kho kinh lon de cat.');
      return;
    }
    try {
      const result = await apiSend<GlassCutPlanResult>('/npp/glass/cut-plan', 'POST', { sheetId: selectedSheetId, pieces });
      setPlan(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tính được phương án cắt.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>Kinh</p>
      <h1 style={pageTitleStyle}>Kho kinh va tinh huong cat</h1>
      <p style={subtitleStyle}>Module doc lap cho NPP: nhap tam kinh lon, khai bao kich thuoc can cat va tinh vi tri cat tren kho kinh.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.35fr', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Layers3 size={18} color={ui.brand} /> Nhap tam kinh</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Ma tam<input style={inputStyle} value={sheetForm.code} onChange={(e) => updateSheet('code', e.target.value)} placeholder="VD: KCL-2440x3660" /></label>
            <label style={labelStyle}>Loai kinh<input style={inputStyle} value={sheetForm.glassType} onChange={(e) => updateSheet('glassType', e.target.value)} placeholder="Kinh cuong luc 8mm, kinh dan an toan..." /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Rong mm<input style={inputStyle} type="number" value={sheetForm.widthMm} onChange={(e) => updateSheet('widthMm', e.target.value)} /></label>
              <label style={labelStyle}>Cao mm<input style={inputStyle} type="number" value={sheetForm.heightMm} onChange={(e) => updateSheet('heightMm', e.target.value)} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>So tam<input style={inputStyle} type="number" value={sheetForm.quantity} onChange={(e) => updateSheet('quantity', e.target.value)} /></label>
              <label style={labelStyle}>Gia/tam<input style={inputStyle} type="number" value={sheetForm.unitCost} onChange={(e) => updateSheet('unitCost', e.target.value)} /></label>
            </div>
            <label style={labelStyle}>Ghi chu<input style={inputStyle} value={sheetForm.note} onChange={(e) => updateSheet('note', e.target.value)} placeholder="Nha cung cap, ma lo, mau kinh" /></label>
            <button onClick={createSheet} style={primaryButtonStyle}><Save size={15} /> Luu tam kinh</button>
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0 }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, color: ui.textMuted, fontSize: 14 }}>Tong gia tri kho kinh: <strong style={{ color: ui.text }}>{currency(totalValue)}</strong></div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Ma tam', 'Loai', 'Kho lon', 'Ton', 'Gia/tam', 'Ghi chu'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {sheets.map((sheet) => (
                  <tr key={sheet.id} onClick={() => setSelectedSheetId(sheet.id)} style={{ cursor: 'pointer', background: selectedSheetId === sheet.id ? ui.brandSoft : 'transparent' }}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{sheet.code}</td>
                    <td style={tableCellStyle}>{sheet.glassType || '-'}</td>
                    <td style={tableCellStyle}>{sheet.widthMm} x {sheet.heightMm} mm</td>
                    <td style={tableCellStyle}>{sheet.quantity.toLocaleString('vi-VN')} tam</td>
                    <td style={tableCellStyle}>{currency(sheet.unitCost)}</td>
                    <td style={tableCellStyle}>{sheet.note || '-'}</td>
                  </tr>
                ))}
                {sheets.length === 0 ? <tr><td colSpan={6} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chua co tam kinh dau vao.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Scissors size={18} color={ui.brand} /> Tinh phuong an cat</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Tam kinh lon
              <select style={inputStyle} value={selectedSheetId} onChange={(e) => setSelectedSheetId(e.target.value)}>
                {sheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.code} - {sheet.widthMm}x{sheet.heightMm}</option>)}
              </select>
            </label>
            <button onClick={() => setPieces((current) => [...current, { widthMm: 500, heightMm: 800, quantity: 1 }])} style={ghostButtonStyle}><Plus size={14} /> Them kich thuoc</button>
            <button onClick={calculatePlan} style={primaryButtonStyle}><Scissors size={15} /> Tinh huong cat</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {pieces.map((piece, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>Rong mm<input style={inputStyle} type="number" value={piece.widthMm} onChange={(e) => updatePiece(index, 'widthMm', e.target.value)} /></label>
                <label style={labelStyle}>Cao mm<input style={inputStyle} type="number" value={piece.heightMm} onChange={(e) => updatePiece(index, 'heightMm', e.target.value)} /></label>
                <label style={labelStyle}>So tam<input style={inputStyle} type="number" value={piece.quantity} onChange={(e) => updatePiece(index, 'quantity', e.target.value)} /></label>
              </div>
            ))}
          </div>
        </div>

        {plan && selectedSheet ? (
          <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, alignItems: 'start' }}>
            <div style={{ border: `1px solid ${ui.borderStrong}`, borderRadius: 12, background: ui.surfaceMuted, padding: 12, overflow: 'auto' }}>
              <div style={{ position: 'relative', width: 760, height: Math.max(220, Math.round(760 * (plan.sheetHeightMm / plan.sheetWidthMm))), background: '#fff', border: `2px solid ${ui.text}`, boxSizing: 'border-box' }}>
                {plan.placements.map((placement) => (
                  <div key={placement.pieceNo} style={{
                    position: 'absolute',
                    left: `${(placement.x / plan.sheetWidthMm) * 100}%`,
                    top: `${(placement.y / plan.sheetHeightMm) * 100}%`,
                    width: `${(placement.widthMm / plan.sheetWidthMm) * 100}%`,
                    height: `${(placement.heightMm / plan.sheetHeightMm) * 100}%`,
                    border: `1px solid ${ui.brand}`,
                    background: ui.brandSoft,
                    color: ui.brandText,
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'grid',
                    placeItems: 'center',
                    boxSizing: 'border-box',
                  }}>{placement.pieceNo}{placement.rotated ? ' R' : ''}</div>
                ))}
              </div>
            </div>
            <div style={{ color: ui.textMuted, fontSize: 14, lineHeight: 1.8 }}>
              <div>Kho lon: <strong style={{ color: ui.text }}>{plan.sheetWidthMm} x {plan.sheetHeightMm} mm</strong></div>
              <div>Số tấm cắt được: <strong style={{ color: ui.text }}>{plan.placements.length}</strong></div>
              <div>Hao hut du kien: <strong style={{ color: ui.text }}>{plan.wastePercent}%</strong></div>
              {plan.errors.length ? <div style={{ color: ui.danger, marginTop: 8 }}>{plan.errors.join(' ')}</div> : null}
            </div>
          </div>
        ) : null}
      </section>
    </NppPage>
  );
}
