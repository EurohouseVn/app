'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, PackagePlus, Plus, Save, Search, Trash2 } from 'lucide-react';
import type { AccessoryPhotoLine, AccessoryPriceMode, NppAccessoryItem, NppAccessorySettings, ReadAccessoryPhotoResult, UpsertNppAccessoryInput } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const emptyForm: UpsertNppAccessoryInput = { name: '', brand: '', category: '', unit: 'cái', quantity: 0, unitCost: 0, priceMode: 'AUTO', salePrice: 0, note: '' };
const emptyLine: AccessoryPhotoLine = { name: '', brand: '', category: '', unit: 'cái', quantity: 1, unitCost: 0 };

/** Giá bán tự động: giá nhập cộng % lãi, làm tròn lên 1.000 đ (cùng công thức với máy chủ, chỉ để xem trước). */
const previewAuto = (cost: number, markup: number) => (cost > 0 ? Math.ceil((cost * (1 + markup / 100)) / 1000 - 1e-9) * 1000 : 0);

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.readAsDataURL(file);
  });
}

export default function NppAccessoriesPage() {
  const [items, setItems] = useState<NppAccessoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<UpsertNppAccessoryInput>(emptyForm);
  const [markup, setMarkup] = useState(20);
  const [markupDraft, setMarkupDraft] = useState('20');
  const [photoLines, setPhotoLines] = useState<AccessoryPhotoLine[] | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    apiGet<NppAccessoryItem[]>(`/npp/accessories${query ? `?q=${encodeURIComponent(query)}` : ''}`)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được phụ kiện.'));
  }

  useEffect(() => {
    load();
    apiGet<NppAccessorySettings>('/npp/accessory-settings').then((s) => { setMarkup(s.markupPercent); setMarkupDraft(String(s.markupPercent)); }).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stockValue = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0), [items]);
  const saleValue = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.salePrice, 0), [items]);

  function updateForm(key: keyof UpsertNppAccessoryInput, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'quantity' || key === 'unitCost' || key === 'salePrice' ? Number(value) : value }));
  }

  async function createItem() {
    setError(''); setMessage('');
    try {
      await apiSend('/npp/accessories', 'POST', form);
      setMessage('Đã thêm phụ kiện vào kho của NPP.');
      setForm(emptyForm);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được phụ kiện.');
    }
  }

  async function patchItem(item: NppAccessoryItem, patch: Partial<UpsertNppAccessoryInput>) {
    setError('');
    try {
      await apiSend(`/npp/accessories/${item.id}`, 'PATCH', patch);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không cập nhật được phụ kiện.');
    }
  }

  async function saveMarkup() {
    setError(''); setMessage('');
    try {
      const saved = await apiSend<NppAccessorySettings>('/npp/accessory-settings', 'PUT', { markupPercent: Number(markupDraft) });
      setMarkup(saved.markupPercent);
      setMessage(`Đã đặt lãi ${saved.markupPercent}%. Giá bán của các phụ kiện để chế độ tự động đã được tính lại.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được % lãi.');
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(''); setMessage(''); setBusy('photo'); setPhotoNote('');
    try {
      setPhotoUrl(URL.createObjectURL(file));
      const result = await apiSend<ReadAccessoryPhotoResult>('/npp/accessories/read-photo', 'POST', { imageBase64: await fileToBase64(file), mime: file.type || 'image/jpeg' });
      setPhotoLines(result.lines.length ? result.lines : [{ ...emptyLine }]);
      setPhotoNote(result.note || `Đã đọc ${result.lines.length} dòng từ ảnh. Xem lại từng dòng trước khi nhập kho.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không đọc được ảnh.');
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function editLine(index: number, patch: Partial<AccessoryPhotoLine>) {
    setPhotoLines((cur) => (cur ?? []).map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function receivePhotoLines() {
    if (!photoLines) return;
    setError(''); setMessage(''); setBusy('receive');
    try {
      const saved = await apiSend<NppAccessoryItem[]>('/npp/accessories/receive', 'POST', { lines: photoLines });
      setMessage(`Đã nhập kho ${saved.length} phụ kiện từ ảnh phiếu.`);
      setPhotoLines(null); setPhotoUrl(''); setPhotoNote('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không nhập kho được.');
    } finally {
      setBusy('');
    }
  }

  const modeButton = (active: boolean): React.CSSProperties => ({ ...ghostButtonStyle, padding: '5px 10px', fontSize: 12, background: active ? ui.brandSoft : ui.surface, color: active ? ui.brandText : ui.text, borderColor: active ? ui.brand : ui.borderStrong });

  return (
    <NppPage>
      <p style={eyebrowStyle}>Phụ kiện</p>
      <h1 style={pageTitleStyle}>Kho phụ kiện của NPP</h1>
      <p style={subtitleStyle}>Quản lý phụ kiện độc lập với WebAdmin. Nhập kho bằng một bức ảnh chụp phiếu, đặt giá bán tự động theo % lãi hoặc tự nhập từng món.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <section style={{ ...panelStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><Camera size={18} color={ui.brand} /> Nhập kho bằng ảnh chụp</h2>
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => onPhoto(e.target.files?.[0])} />
            <button style={primaryButtonStyle} disabled={busy === 'photo'} onClick={() => fileRef.current?.click()}><Camera size={15} /> {busy === 'photo' ? 'Đang đọc ảnh...' : 'Chụp hoặc chọn ảnh phiếu'}</button>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', color: ui.textMuted, fontSize: 13 }}>Chụp hóa đơn nhà cung cấp hoặc phiếu giao hàng bằng điện thoại. Hệ thống đọc từng dòng, anh chị chỉnh lại rồi mới chốt nhập kho.</p>
        {photoLines ? (
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: photoUrl ? '220px 1fr' : '1fr', gap: 16, alignItems: 'start' }}>
            {photoUrl ? <img src={photoUrl} alt="Ảnh phiếu" style={{ width: '100%', borderRadius: 10, border: `1px solid ${ui.border}` }} /> : null}
            <div>
              {photoNote ? <p style={{ margin: '0 0 8px', color: ui.textMuted, fontSize: 13 }}>{photoNote}</p> : null}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Tên phụ kiện', 'Hãng', 'Loại', 'Đơn vị', 'Số lượng', 'Giá nhập', 'Giá bán tự động', ''].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
                  <tbody>
                    {photoLines.map((line, i) => (
                      <tr key={i}>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, minWidth: 150 }} value={line.name} onChange={(e) => editLine(i, { name: e.target.value })} /></td>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, width: 90 }} value={line.brand} onChange={(e) => editLine(i, { brand: e.target.value })} /></td>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, width: 90 }} value={line.category} onChange={(e) => editLine(i, { category: e.target.value })} /></td>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, width: 60 }} value={line.unit} onChange={(e) => editLine(i, { unit: e.target.value })} /></td>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, width: 70 }} type="number" value={line.quantity} onChange={(e) => editLine(i, { quantity: Number(e.target.value) })} /></td>
                        <td style={tableCellStyle}><input style={{ ...inputStyle, height: 34, width: 100 }} type="number" value={line.unitCost} onChange={(e) => editLine(i, { unitCost: Number(e.target.value) })} /></td>
                        <td style={{ ...tableCellStyle, fontWeight: 800, color: ui.brandText }}>{currency(previewAuto(line.unitCost, markup))}</td>
                        <td style={tableCellStyle}><button style={{ ...ghostButtonStyle, padding: 6 }} aria-label="Xóa dòng" onClick={() => setPhotoLines((cur) => (cur ?? []).filter((_, k) => k !== i))}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button style={ghostButtonStyle} onClick={() => setPhotoLines((cur) => [...(cur ?? []), { ...emptyLine }])}><Plus size={14} /> Thêm dòng</button>
                <button style={primaryButtonStyle} disabled={busy === 'receive'} onClick={receivePhotoLines}><CheckCircle2 size={15} /> Chốt nhập kho</button>
                <button style={ghostButtonStyle} onClick={() => { setPhotoLines(null); setPhotoUrl(''); }}>Bỏ phiếu</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section style={{ ...panelStyle, marginTop: 16, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: ui.text }}>Giá bán tự động</strong>
          <p style={{ margin: '4px 0 0', color: ui.textMuted, fontSize: 13 }}>Giá bán = giá nhập + % lãi, làm tròn lên 1.000 đ. Món nào cần giá riêng thì chuyển sang "Thủ công" và tự nhập.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}>
          <label style={labelStyle}>% lãi trên giá nhập<input style={{ ...inputStyle, width: 120 }} type="number" min="0" max="500" value={markupDraft} onChange={(e) => setMarkupDraft(e.target.value)} /></label>
          <button style={primaryButtonStyle} onClick={saveMarkup}><Save size={15} /> Áp dụng</button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.5fr', gap: 20, marginTop: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <h2 style={{ margin: '0 0 14px', color: ui.text, fontSize: 18, display: 'flex', gap: 8, alignItems: 'center' }}><PackagePlus size={18} color={ui.brand} /> Thêm phụ kiện</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>Tên phụ kiện<input style={inputStyle} value={form.name} onChange={(e) => updateForm('name', e.target.value)} placeholder="Bản lề, khóa, ray trượt..." /></label>
            <label style={labelStyle}>Hãng<input style={inputStyle} value={form.brand} onChange={(e) => updateForm('brand', e.target.value)} placeholder="Kinlong, Hafele, Eurohouse..." /></label>
            <label style={labelStyle}>Loại<input style={inputStyle} value={form.category} onChange={(e) => updateForm('category', e.target.value)} placeholder="Khóa / bản lề / keo / silicon" /></label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <label style={labelStyle}>Đơn vị<input style={inputStyle} value={form.unit} onChange={(e) => updateForm('unit', e.target.value)} placeholder="cái" /></label>
              <label style={labelStyle}>Số lượng<input style={inputStyle} type="number" value={form.quantity} onChange={(e) => updateForm('quantity', e.target.value)} /></label>
              <label style={labelStyle}>Giá nhập<input style={inputStyle} type="number" value={form.unitCost} onChange={(e) => updateForm('unitCost', e.target.value)} /></label>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button style={modeButton(form.priceMode !== 'MANUAL')} onClick={() => setForm((f) => ({ ...f, priceMode: 'AUTO' }))}>Giá bán tự động</button>
              <button style={modeButton(form.priceMode === 'MANUAL')} onClick={() => setForm((f) => ({ ...f, priceMode: 'MANUAL' }))}>Thủ công</button>
              {form.priceMode === 'MANUAL'
                ? <input style={{ ...inputStyle, width: 130 }} type="number" value={form.salePrice} onChange={(e) => updateForm('salePrice', e.target.value)} placeholder="Giá bán" />
                : <strong style={{ color: ui.brandText }}>{currency(previewAuto(form.unitCost ?? 0, markup))}</strong>}
            </div>
            <label style={labelStyle}>Ghi chú<input style={inputStyle} value={form.note} onChange={(e) => updateForm('note', e.target.value)} placeholder="Mã hóa đơn, nhà cung cấp, quy cách" /></label>
            <button onClick={createItem} style={primaryButtonStyle}><Save size={15} /> Lưu phụ kiện</button>
          </div>
        </section>

        <section style={{ ...panelStyle, padding: 0 }}>
          <div style={{ padding: 16, borderBottom: `1px solid ${ui.border}`, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ color: ui.textMuted, fontSize: 14 }}>Giá trị nhập: <strong style={{ color: ui.text }}>{currency(stockValue)}</strong> · Giá trị bán: <strong style={{ color: ui.brandText }}>{currency(saleValue)}</strong></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, width: 220 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, hãng, loại" />
              <button onClick={load} style={ghostButtonStyle}><Search size={14} /> Tìm</button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Tên', 'Hãng', 'Tồn', 'Giá nhập', 'Giá bán', 'Cách đặt giá', 'Cập nhật tồn'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 800 }}>{item.name}<div style={{ fontWeight: 500, color: ui.textFaint, fontSize: 12 }}>{item.category || '-'}</div></td>
                    <td style={tableCellStyle}>{item.brand || '-'}</td>
                    <td style={tableCellStyle}>{item.quantity.toLocaleString('vi-VN')} {item.unit}</td>
                    <td style={tableCellStyle}>{currency(item.unitCost)}</td>
                    <td style={{ ...tableCellStyle, fontWeight: 800, color: ui.brandText }}>
                      {item.priceMode === 'MANUAL'
                        ? <input key={`${item.id}-${item.salePrice}`} style={{ ...inputStyle, width: 110, height: 34 }} type="number" defaultValue={item.salePrice} onBlur={(e) => Number(e.target.value) !== item.salePrice && patchItem(item, { salePrice: Number(e.target.value) })} />
                        : currency(item.salePrice)}
                    </td>
                    <td style={tableCellStyle}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button style={modeButton(item.priceMode === 'AUTO')} onClick={() => item.priceMode !== 'AUTO' && patchItem(item, { priceMode: 'AUTO' })}>Tự động</button>
                        <button style={modeButton(item.priceMode === 'MANUAL')} onClick={() => item.priceMode !== 'MANUAL' && patchItem(item, { priceMode: 'MANUAL' as AccessoryPriceMode, salePrice: item.salePrice })}>Thủ công</button>
                      </div>
                    </td>
                    <td style={tableCellStyle}><input style={{ ...inputStyle, width: 80, height: 34 }} type="number" defaultValue={item.quantity} onBlur={(e) => Number(e.target.value) !== item.quantity && patchItem(item, { quantity: Number(e.target.value) })} /></td>
                  </tr>
                ))}
                {items.length === 0 ? <tr><td colSpan={7} style={{ ...tableCellStyle, color: ui.textFaint, textAlign: 'center' }}>Chưa có phụ kiện.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </NppPage>
  );
}
