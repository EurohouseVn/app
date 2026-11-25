'use client';

import { useEffect, useMemo, useState } from 'react';
import { Barcode, Layers3, PackagePlus, Plus, Printer, Save, Tags } from 'lucide-react';
import type {
  NppBarcodeSchemeItem,
  NppGlassSheetItem,
  NppGlassStockKind,
  ReceiveNppGlassStockInput,
  UpsertNppBarcodeSchemeInput,
} from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { previewGlassBarcode } from '../../src/lib/glassBarcode';
import { GlassCutPlanner } from '../../src/components/GlassCutPlanner';
import {
  BarcodeSvg,
  DEFAULT_LABEL_SIZE,
  GlassLabelPrintSheet,
  loadLabelSize,
  saveLabelSize,
  type GlassLabelData,
  type LabelSize,
} from '../../src/components/GlassLabels';
import { chipStyle, currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const KIND_LABEL: Record<NppGlassStockKind, string> = { SHEET: 'Tấm nguyên', REMNANT: 'Tấm dư', CUT_PIECE: 'Tấm cắt' };

type ReceiveForm = { schemeId: string; widthMm: string; heightMm: string; quantity: string; unitCost: string; location: string; kind: NppGlassStockKind; note: string };
const emptyReceive: ReceiveForm = { schemeId: '', widthMm: '2440', heightMm: '3660', quantity: '1', unitCost: '', location: '', kind: 'SHEET', note: '' };
const emptyScheme = { prefix: '', label: '', glassType: '', thicknessMm: '' };

const isLegacy = (barcode?: string) => !barcode || barcode.startsWith('LEGACY-');
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export default function NppGlassPage() {
  const [schemes, setSchemes] = useState<NppBarcodeSchemeItem[]>([]);
  const [stock, setStock] = useState<NppGlassSheetItem[]>([]);
  const [schemeForm, setSchemeForm] = useState(emptyScheme);
  const [receive, setReceive] = useState<ReceiveForm>(emptyReceive);
  const [receiveKey, setReceiveKey] = useState(newKey);
  const [labelSize, setLabelSize] = useState<LabelSize>(DEFAULT_LABEL_SIZE);
  const [printLabels, setPrintLabels] = useState<GlassLabelData[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<NppBarcodeSchemeItem[]>('/npp/glass/schemes')
      .then((items) => {
        setSchemes(items);
        setReceive((current) => (current.schemeId || !items.length ? current : { ...current, schemeId: items.find((item) => item.active)?.id ?? '' }));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được mã đầu.'));
    apiGet<NppGlassSheetItem[]>('/npp/glass/stock')
      .then(setStock)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được kho kính.'));
  }

  useEffect(() => {
    setLabelSize(loadLabelSize());
    load();
  }, []);

  // In: chờ mã vạch vẽ xong rồi mới mở hộp thoại in, và dọn vùng in sau khi in xong.
  useEffect(() => {
    if (!printLabels.length) return undefined;
    const clear = () => setPrintLabels([]);
    window.addEventListener('afterprint', clear, { once: true });
    const timer = window.setTimeout(() => window.print(), 300);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', clear);
    };
  }, [printLabels]);

  const activeSchemes = useMemo(() => schemes.filter((item) => item.active), [schemes]);
  const selectedScheme = schemes.find((item) => item.id === receive.schemeId);
  const previewCode = selectedScheme ? previewGlassBarcode(selectedScheme.prefix, Number(receive.widthMm), Number(receive.heightMm)) : null;
  const totalValue = useMemo(() => stock.reduce((sum, row) => sum + row.quantity * row.unitCost, 0), [stock]);
  const totalPieces = useMemo(() => stock.reduce((sum, row) => sum + row.quantity, 0), [stock]);

  function fail(e: unknown, fallback: string) {
    setMessage('');
    setError(e instanceof Error ? e.message : fallback);
  }

  function labelFor(row: NppGlassSheetItem): GlassLabelData | null {
    if (isLegacy(row.barcode)) return null;
    return {
      barcode: row.barcode!,
      widthMm: row.widthMm,
      heightMm: row.heightMm,
      glassType: row.glassType || undefined,
      location: row.location || undefined,
      kindLabel: row.kind && row.kind !== 'SHEET' ? KIND_LABEL[row.kind] : undefined,
    };
  }

  function printRow(row: NppGlassSheetItem, copies: number) {
    const label = labelFor(row);
    if (!label) {
      setError('Dòng này nhập từ bản cũ, chưa có mã vạch. Nhập lại bằng mã đầu để có mã.');
      return;
    }
    setError('');
    setPrintLabels(Array.from({ length: Math.min(Math.max(1, copies), 500) }, () => label));
  }

  async function createScheme() {
    setError('');
    setMessage('');
    const body: UpsertNppBarcodeSchemeInput = {
      prefix: schemeForm.prefix,
      label: schemeForm.label,
      glassType: schemeForm.glassType,
      thicknessMm: schemeForm.thicknessMm ? Number(schemeForm.thicknessMm) : null,
    };
    try {
      await apiSend('/npp/glass/schemes', 'POST', body);
      setMessage(`Đã thêm mã đầu ${schemeForm.prefix.trim().toUpperCase()}.`);
      setSchemeForm(emptyScheme);
      load();
    } catch (e) {
      fail(e, 'Không lưu được mã đầu.');
    }
  }

  async function toggleScheme(scheme: NppBarcodeSchemeItem) {
    setError('');
    try {
      await apiSend(`/npp/glass/schemes/${scheme.id}`, 'PATCH', { active: !scheme.active });
      load();
    } catch (e) {
      fail(e, 'Không đổi được trạng thái mã đầu.');
    }
  }

  async function receiveStock() {
    setError('');
    setMessage('');
    const body: ReceiveNppGlassStockInput = {
      schemeId: receive.schemeId,
      widthMm: Number(receive.widthMm),
      heightMm: Number(receive.heightMm),
      quantity: Number(receive.quantity),
      unitCost: receive.unitCost ? Number(receive.unitCost) : undefined,
      location: receive.location,
      kind: receive.kind,
      note: receive.note,
      idempotencyKey: receiveKey,
    };
    try {
      const saved = await apiSend<NppGlassSheetItem>('/npp/glass/stock/receive', 'POST', body);
      setMessage(`Đã nhập ${body.quantity} tấm ${saved.barcode}. Tồn hiện tại: ${saved.quantity} tấm.`);
      setReceiveKey(newKey());
      setReceive((current) => ({ ...current, quantity: '1', note: '' }));
      load();
    } catch (e) {
      fail(e, 'Không nhập được kính.');
    }
  }

  function updateLabelSize(key: keyof LabelSize, value: string) {
    const next = { ...labelSize, [key]: Number(value) || 0 };
    setLabelSize(next);
    if (next.widthMm >= 20 && next.widthMm <= 200 && next.heightMm >= 15 && next.heightMm <= 200) saveLabelSize(next);
  }

  const sizeValid = labelSize.widthMm >= 20 && labelSize.widthMm <= 200 && labelSize.heightMm >= 15 && labelSize.heightMm <= 200;

  return (
    <NppPage>
      <p style={eyebrowStyle}>Kính</p>
      <h1 style={pageTitleStyle}>Kho kính, mã vạch và tính hướng cắt</h1>
      <p style={subtitleStyle}>Đặt mã đầu cho từng loại kính, nhập kính theo kích thước để hệ thống tự sinh mã vạch, in nhãn dán lên tấm kính.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p role="alert" style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 6px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Tags size={18} color={ui.brand} /> Mã đầu mã vạch</h2>
          <p style={{ margin: '0 0 12px', color: ui.textMuted, fontSize: 13, lineHeight: 1.5 }}>Mỗi mã đầu là một loại kính (ví dụ <strong>CL8</strong> là cường lực 8 ly). Phần số phía sau do hệ thống tự sinh từ kích thước: <strong>CL8-0600-0900</strong> là tấm 600 × 900 mm. Đã đặt mã đầu thì không đổi, vì nhãn đã in phải còn đọc được.</p>
          <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
            {schemes.map((scheme) => (
              <div key={scheme.id} style={{ border: `1px solid ${ui.border}`, borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: scheme.active ? 1 : 0.6 }}>
                <div>
                  <strong style={{ color: ui.text, fontSize: 15, letterSpacing: '0.04em' }}>{scheme.prefix}</strong>
                  <span style={{ color: ui.textMuted, fontSize: 13, marginLeft: 10 }}>{[scheme.label, scheme.glassType, scheme.thicknessMm ? `${scheme.thicknessMm} mm` : ''].filter(Boolean).join(' · ') || 'Chưa mô tả'}</span>
                </div>
                <button onClick={() => toggleScheme(scheme)} style={ghostButtonStyle}>{scheme.active ? 'Ngừng dùng' : 'Dùng lại'}</button>
              </div>
            ))}
            {schemes.length === 0 ? <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Chưa có mã đầu nào. Thêm mã đầu đầu tiên bên dưới.</p> : null}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
              <label style={labelStyle}>Mã đầu<input style={inputStyle} value={schemeForm.prefix} maxLength={6} onChange={(e) => setSchemeForm({ ...schemeForm, prefix: e.target.value.toUpperCase() })} placeholder="CL8" /></label>
              <label style={labelStyle}>Mô tả<input style={inputStyle} value={schemeForm.label} onChange={(e) => setSchemeForm({ ...schemeForm, label: e.target.value })} placeholder="Cường lực 8 ly trắng" /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
              <label style={labelStyle}>Loại kính<input style={inputStyle} value={schemeForm.glassType} onChange={(e) => setSchemeForm({ ...schemeForm, glassType: e.target.value })} placeholder="Kính cường lực" /></label>
              <label style={labelStyle}>Độ dày (mm)<input style={inputStyle} type="number" min="0" step="0.1" value={schemeForm.thicknessMm} onChange={(e) => setSchemeForm({ ...schemeForm, thicknessMm: e.target.value })} placeholder="8" /></label>
            </div>
            <button onClick={createScheme} style={primaryButtonStyle}><Plus size={15} /> Thêm mã đầu</button>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><PackagePlus size={18} color={ui.brand} /> Nhập kính</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Mã đầu (loại kính)
              <select style={inputStyle} value={receive.schemeId} onChange={(e) => setReceive({ ...receive, schemeId: e.target.value })}>
                <option value="">Chọn mã đầu</option>
                {activeSchemes.map((scheme) => <option key={scheme.id} value={scheme.id}>{scheme.prefix} — {scheme.label || scheme.glassType || 'chưa mô tả'}</option>)}
              </select>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Rộng (mm)<input style={inputStyle} type="number" min="1" max="9999" value={receive.widthMm} onChange={(e) => setReceive({ ...receive, widthMm: e.target.value })} /></label>
              <label style={labelStyle}>Cao (mm)<input style={inputStyle} type="number" min="1" max="9999" value={receive.heightMm} onChange={(e) => setReceive({ ...receive, heightMm: e.target.value })} /></label>
              <label style={labelStyle}>Số tấm<input style={inputStyle} type="number" min="1" step="1" value={receive.quantity} onChange={(e) => setReceive({ ...receive, quantity: e.target.value })} /></label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Loại hàng
                <select style={inputStyle} value={receive.kind} onChange={(e) => setReceive({ ...receive, kind: e.target.value as NppGlassStockKind })}>
                  {(Object.keys(KIND_LABEL) as NppGlassStockKind[]).map((kind) => <option key={kind} value={kind}>{KIND_LABEL[kind]}</option>)}
                </select>
              </label>
              <label style={labelStyle}>Vị trí kệ<input style={inputStyle} value={receive.location} onChange={(e) => setReceive({ ...receive, location: e.target.value })} placeholder="Kệ A1" /></label>
              <label style={labelStyle}>Giá nhập/tấm<input style={inputStyle} type="number" min="0" value={receive.unitCost} onChange={(e) => setReceive({ ...receive, unitCost: e.target.value })} /></label>
            </div>
            <label style={labelStyle}>Ghi chú<input style={inputStyle} value={receive.note} onChange={(e) => setReceive({ ...receive, note: e.target.value })} placeholder="Nhà cung cấp, số lô, màu kính" /></label>
            <div style={{ border: `1px dashed ${ui.borderStrong}`, borderRadius: 12, padding: 12, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ color: ui.textMuted, fontSize: 12, fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}><Barcode size={14} /> Mã vạch sẽ sinh ra</div>
                {previewCode ? <strong data-testid="barcode-preview" style={{ display: 'block', marginTop: 6, color: ui.text, fontSize: 20, letterSpacing: '0.04em', fontFamily: 'Consolas, monospace' }}>{previewCode}</strong>
                  : <span style={{ display: 'block', marginTop: 6, color: ui.textFaint, fontSize: 13 }}>Chọn mã đầu và nhập kích thước từ 1 đến 9999 mm.</span>}
              </div>
              <div style={{ width: 150, height: 44, background: '#fff', padding: 4, borderRadius: 6, flex: '0 0 auto' }}>{previewCode ? <BarcodeSvg value={previewCode} /> : null}</div>
            </div>
            <button onClick={receiveStock} disabled={!previewCode} style={{ ...primaryButtonStyle, opacity: previewCode ? 1 : 0.6 }}><Save size={15} /> Nhập vào kho</button>
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle, marginTop: 20, padding: 0 }}>
        <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ color: ui.textMuted, fontSize: 14 }}>
            <Layers3 size={16} color={ui.brand} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
            Tồn <strong style={{ color: ui.text }}>{totalPieces.toLocaleString('vi-VN')} tấm</strong> · giá trị <strong style={{ color: ui.text }}>{currency(totalValue)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={{ ...labelStyle, fontSize: 12 }}>Khổ tem rộng (mm)<input aria-label="Khổ tem rộng" style={{ ...inputStyle, width: 90 }} type="number" value={labelSize.widthMm || ''} onChange={(e) => updateLabelSize('widthMm', e.target.value)} /></label>
            <label style={{ ...labelStyle, fontSize: 12 }}>Khổ tem cao (mm)<input aria-label="Khổ tem cao" style={{ ...inputStyle, width: 90 }} type="number" value={labelSize.heightMm || ''} onChange={(e) => updateLabelSize('heightMm', e.target.value)} /></label>
            {!sizeValid ? <span style={{ color: ui.danger, fontSize: 12 }}>Khổ tem 20–200 × 15–200 mm</span> : null}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Mã vạch', 'Loại kính', 'Kích thước', 'Loại hàng', 'Vị trí', 'Tồn', 'Giá/tấm', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 800, fontFamily: 'Consolas, monospace' }}>{isLegacy(row.barcode) ? <span style={{ color: ui.textFaint, fontWeight: 600 }}>{row.code} (chưa có mã vạch)</span> : row.barcode}</td>
                  <td style={tableCellStyle}>{row.glassType || '-'}</td>
                  <td style={tableCellStyle}>{row.widthMm} × {row.heightMm} mm</td>
                  <td style={tableCellStyle}><span style={chipStyle(row.kind === 'REMNANT' ? 'warning' : 'success')}>{KIND_LABEL[row.kind ?? 'SHEET']}</span></td>
                  <td style={tableCellStyle}>{row.location || '-'}</td>
                  <td style={tableCellStyle}>{row.quantity.toLocaleString('vi-VN')} tấm</td>
                  <td style={tableCellStyle}>{currency(row.unitCost)}</td>
                  <td style={tableCellStyle}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button disabled={!sizeValid || isLegacy(row.barcode)} onClick={() => printRow(row, 1)} style={{ ...ghostButtonStyle, opacity: sizeValid && !isLegacy(row.barcode) ? 1 : 0.5 }} title="In một nhãn"><Printer size={14} /> In 1</button>
                      <button disabled={!sizeValid || isLegacy(row.barcode)} onClick={() => printRow(row, row.quantity)} style={{ ...ghostButtonStyle, opacity: sizeValid && !isLegacy(row.barcode) ? 1 : 0.5 }} title="In đủ nhãn cho cả số tấm đang tồn"><Printer size={14} /> In {row.quantity}</button>
                    </div>
                  </td>
                </tr>
              ))}
              {stock.length === 0 ? <tr><td colSpan={8} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chưa có kính trong kho. Thêm mã đầu rồi nhập kính ở phía trên.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <GlassCutPlanner schemes={schemes} onStockChanged={load} onPrint={setPrintLabels} labelSizeValid={sizeValid} />

      <GlassLabelPrintSheet labels={printLabels} size={labelSize} />
    </NppPage>
  );
}
