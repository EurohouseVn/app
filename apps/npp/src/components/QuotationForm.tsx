'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calculator, Download, Plus, Save, Trash2 } from 'lucide-react';
import type { QuotationInput, QuotationRecord, QuotationResult } from '@eurohouse/types';
import { apiBlob, apiGet, apiSend } from '../lib/api';
import { currency, inputStyle, labelStyle, pageTitleStyle, panelStyle, panelTitleStyle, primaryButtonStyle, tableCellStyle, tableHeadStyle, ui } from '../ui';

type QuoteItem = {
  name: string;
  system: string;
  doorType: string;
  widthMm: number;
  heightMm: number;
  quantity: number;
  pricePerM2: number;
  color: string;
  glassType: string;
};

type ExtraItem = {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

const defaultItem: QuoteItem = {
  name: 'D1-Cửa chính',
  system: 'Hệ Ecento 70',
  doorType: 'Cửa 2 cánh 110',
  widthMm: 2200,
  heightMm: 2400,
  quantity: 1,
  pricePerM2: 2800000,
  color: '',
  glassType: '',
};

const QUOTE_NAMES = ['D1-Cửa chính', 'D2', 'D3', 'CS1', 'CS2', 'CS3', 'VK1', 'VK2', 'VK3', 'OFix 1', 'OFix 2', 'Khác'];
const SYSTEM_OPTIONS = ['Hệ 55 Euroqueen', 'Hệ 55 Preco', 'Hệ trượt Châu Âu', 'Hệ Trượt quay', 'Hệ Ecento 70', 'Hệ Ecento Plus', 'Hệ Thuỷ lực', 'Hệ nội thất', 'Hệ chấn song', 'Hệ phào đại hội', 'Hệ mặt dựng'];
const COLORS = ['Màu Café Metalic', 'Màu Café thường', 'Màu Xám Ngọc Trai', 'Màu Vân gỗ Cẩm Lai', 'Màu vân gỗ Olak', 'Màu Xám Rita (dự án)'];
const GLASS_TYPES = ['Kính dán 6.38', 'Kính dán 8.38', 'Kính cường lực 8mm', 'Kính cường lực 10mm', 'Kính cường lực 12mm', 'Kính hộp thường', 'Kính hộp nan đồng', 'Tấm nhôm liền 10mm', 'Tấm nhôm liền 18mm'];

function getSystemOptions(name: string, color?: string) {
  const upper = (name || '').trim().toUpperCase();
  if (upper.startsWith('CS')) return ['Hệ cửa sổ 55', 'Hệ cửa sổ Ecento 70', 'Hệ cửa sổ Ecento Plus', 'Hệ chấn song'];
  if (upper.startsWith('VK')) return ['Vách hệ 55', 'Vách hệ Ecento 70', 'Vách hệ Ecento Plus', 'Hệ mặt dựng'];
  let options = SYSTEM_OPTIONS.filter((system) => !['Hệ nội thất', 'Hệ chấn song', 'Hệ phào đại hội', 'Hệ mặt dựng'].includes(system));
  if (name !== 'D1-Cửa chính' && name !== 'D2') options = options.filter((system) => system !== 'Hệ Thuỷ lực');
  if (color === 'Màu Xám Rita (dự án)' || color === 'Màu Café thường') {
    options = options.filter((system) => !['Hệ Thuỷ lực', 'Hệ Trượt quay', 'Hệ Ecento 70', 'Hệ Ecento Plus', 'Hệ trượt Châu Âu'].includes(system));
  }
  return options;
}

function getDoorTypeOptions(name: string, system: string) {
  const upperName = (name || '').trim().toUpperCase();
  const upperSystem = (system || '').trim().toUpperCase();
  if (upperName.startsWith('CS') || upperSystem.includes('CỬA SỔ')) {
    return ['Cửa lùa 2 cánh', 'Cửa lùa 4 cánh', 'Cửa mở hất 1 cánh', 'Cửa mở hất 2 cánh + Vách', 'Cửa mở hất 3 cánh', 'Cửa 2 cánh quay-2 cánh hất', 'Cửa 1 cánh quay', 'Cửa 2 cánh quay + Vách', 'Cửa 2 cánh quay - 1 cánh hất'];
  }
  if (upperName.startsWith('VK') || upperSystem.includes('VÁCH') || upperSystem.includes('MẶT DỰNG')) {
    if (upperSystem.includes('MẶT DỰNG')) return ['Mặt dựng hệ 65', 'Mặt dựng hệ 65 (Gồm cửa)', 'Mặt dựng hệ 120', 'Mặt dựng hệ 120 (Gồm cửa)'];
    return ['Vách kính độc lập', 'Vách kính kèm cửa sổ'];
  }
  switch (system) {
    case 'Hệ Thuỷ lực': return ['Cửa TL 1 cánh 140', 'Cửa TL 1 cánh 180', 'Cửa TL 2 cánh 140', 'Cửa TL 2 cánh 180'];
    case 'Hệ Ecento 70': return ['Cửa 1 cánh 110', 'Cửa 2 cánh 110', 'Cửa 4 cánh 110', 'Cửa 1 cánh 150', 'Cửa 2 cánh 150', 'Cửa 4 cánh 150', 'Cửa 1 cánh 190', 'Cửa 2 cánh 190', 'Cửa 4 cánh 190'];
    case 'Hệ Ecento Plus': return ['Cửa 1 cánh 98', 'Cửa 2 cánh 98', 'Cửa 4 cánh 98', 'Cửa 1 cánh 138', 'Cửa 2 cánh 138', 'Cửa 4 cánh 138', 'Cửa 1 cánh liền phào 138', 'Cửa 2 cánh liền phào 138', 'Cửa 4 cánh liền phào 138'];
    case 'Hệ Trượt quay': return ['Trượt quay 2 cánh', 'Trượt quay 4 cánh'];
    case 'Hệ trượt Châu Âu': return ['Cửa trượt ray đơn 1 cánh', 'Cửa trượt ray đôi 2 cánh', 'Cửa trượt ray đôi 4 cánh', 'Cửa trượt 3 ray - 3 cánh', 'Cửa trượt 3 ray - 6 cánh'];
    case 'Hệ 55 Euroqueen': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91', 'Cửa 1 cánh VIP 118', 'Cửa 2 cánh VIP 118', 'Cửa 4 cánh VIP 118', 'Cửa 1 cánh liền phào 125', 'Cửa 2 cánh liền phào 125', 'Cửa 4 cánh liền phào 125'];
    case 'Hệ 55 Preco': return ['Cửa 1 cánh 91', 'Cửa 2 cánh 91', 'Cửa 4 cánh 91'];
    case 'Hệ chấn song': return ['Chấn song cửa sổ', 'Chấn song trang trí'];
    case 'Hệ nội thất': return ['Cánh nội thất', 'Khung nội thất', 'Vách nội thất'];
    case 'Hệ phào đại hội': return ['Phào cửa đi', 'Phào cửa sổ', 'Phào trang trí'];
    default: return ['Cửa 1 cánh', 'Cửa 2 cánh', 'Cửa 4 cánh'];
  }
}

function toPayload(items: QuoteItem[], extras: ExtraItem[], form: { customerName: string; customerPhone: string; customerAddress: string; notes: string; vatPct: number; depositAmount: number; isFinalSettlement: boolean }): QuotationInput {
  return {
    customerName: form.customerName,
    customerPhone: form.customerPhone,
    customerAddress: form.customerAddress,
    notes: form.notes,
    vatPct: Number(form.vatPct || 0),
    depositAmount: Number(form.depositAmount || 0),
    isFinalSettlement: form.isFinalSettlement,
    accessoryCost: 0,
    laborCost: 0,
    installCost: 0,
    depreciation: 0,
    profitPct: 0,
    items: items.map((item) => ({
      name: item.name,
      system: item.system,
      doorType: item.doorType,
      widthMm: Number(item.widthMm),
      heightMm: Number(item.heightMm),
      quantity: Number(item.quantity),
      pricePerM2: Number(item.pricePerM2),
      color: item.color,
      glassType: item.glassType,
      includesAccessories: true,
      accessoriesPrice: 0,
    })),
    extraProducts: extras
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        description: item.name.trim(),
        unit: item.unit || 'bộ',
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice || 0),
        totalPrice: Math.round(Number(item.quantity || 0) * Number(item.unitPrice || 0)),
      })),
  };
}

export function QuotationForm({ initialId = null }: { initialId?: string | null }) {
  const router = useRouter();
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    notes: '',
    vatPct: 0,
    depositAmount: 0,
    isFinalSettlement: false,
  });
  const [items, setItems] = useState<QuoteItem[]>([{ ...defaultItem }]);
  const [extras, setExtras] = useState<ExtraItem[]>([{ name: '', unit: 'bộ', quantity: 1, unitPrice: 0 }]);
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(initialId);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const loadRecord = useCallback(async () => {
    if (!initialId) return;
    try {
      const rec = await apiGet<QuotationRecord>(`/quotations/${initialId}`);
      setForm({
        customerName: rec.customerName || '',
        customerPhone: rec.customerPhone || '',
        customerAddress: rec.customerAddress || '',
        notes: rec.notes || '',
        vatPct: rec.vatPct || 0,
        depositAmount: rec.depositAmount || 0,
        isFinalSettlement: rec.isFinalSettlement || false,
      });
      setItems(rec.items.map((item) => ({
        name: item.name || '',
        system: item.system || '',
        doorType: item.doorType,
        widthMm: item.widthMm,
        heightMm: item.heightMm,
        quantity: item.quantity,
        pricePerM2: item.pricePerM2,
        color: item.color || '',
        glassType: item.glassType || '',
      })));
      setExtras((rec.extraProducts || []).map((item) => ({
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })));
      setResult(rec);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không tải được báo giá.');
    }
  }, [initialId]);

  useEffect(() => { loadRecord(); }, [loadRecord]);

  function updateForm(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({
      ...current,
      [key]: key === 'vatPct' || key === 'depositAmount' ? Number(value) : value,
    }));
  }

  function updateItem(index: number, key: keyof QuoteItem, value: string) {
    setItems((current) => current.map((item, idx) => {
      if (idx !== index) return item;
      const next: QuoteItem = {
        ...item,
        [key]: ['widthMm', 'heightMm', 'quantity', 'pricePerM2'].includes(key) ? Number(value) : value,
      } as QuoteItem;
      if (key === 'name' || key === 'color') {
        const systems = getSystemOptions(next.name, next.color);
        if (!systems.includes(next.system)) next.system = systems[0] ?? next.system;
      }
      if (key === 'name' || key === 'system' || key === 'color') {
        const doorTypes = getDoorTypeOptions(next.name, next.system);
        if (!doorTypes.includes(next.doorType)) next.doorType = doorTypes[0] ?? next.doorType;
      }
      return next;
    }));
  }

  function updateExtra(index: number, key: keyof ExtraItem, value: string) {
    setExtras((current) => current.map((item, idx) => idx === index ? {
      ...item,
      [key]: key === 'quantity' || key === 'unitPrice' ? Number(value) : value,
    } : item));
  }

  async function calculate(showMessage = true) {
    setLoading(true);
    if (showMessage) setMessage('');
    try {
      const payload = toPayload(items, extras, form);
      const data = await apiSend<QuotationResult>('/quotations/calc', 'POST', payload);
      setResult(data);
      if (showMessage) setMessage('Đã tính báo giá.');
      return data;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không tính được báo giá.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setLoading(true);
    setMessage('');
    try {
      const payload = toPayload(items, extras, form);
      const data = savedId
        ? await apiSend<QuotationRecord>(`/quotations/${savedId}`, 'PUT', payload)
        : await apiSend<QuotationRecord>('/quotations', 'POST', payload);
      setSavedId(data.id);
      setResult(data);
      setMessage(savedId ? 'Đã cập nhật báo giá.' : 'Đã lưu báo giá.');
      if (!savedId) router.replace(`/quotations/${data.id}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không lưu được báo giá.');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!savedId) {
      setMessage('Vui lòng lưu báo giá trước khi xuất PDF.');
      return;
    }
    const blob = await apiBlob(`/quotations/${savedId}/pdf`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-gia-${savedId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <button onClick={() => router.back()} style={{ background: 'transparent', border: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: ui.textMuted, fontWeight: 700 }}>
          <ArrowLeft size={18} /> Quay lại
        </button>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={() => calculate()} disabled={loading} style={{ ...primaryButtonStyle, background: ui.teal }}><Calculator size={16} /> Tính báo giá</button>
          <button onClick={save} disabled={loading} style={primaryButtonStyle}><Save size={16} /> Lưu báo giá</button>
          <button onClick={downloadPdf} style={{ ...primaryButtonStyle, background: ui.blue }}><Download size={16} /> PDF</button>
        </div>
      </div>

      <h1 style={pageTitleStyle}>{savedId ? 'Sửa báo giá' : 'Tạo báo giá mới'}</h1>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '7px 12px', borderRadius: 8 }}>{message}</p> : null}

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={panelTitleStyle}>Thông tin khách hàng</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={labelStyle}>Tên khách hàng<input style={inputStyle} value={form.customerName} onChange={(e) => updateForm('customerName', e.target.value)} placeholder="Tên khách hàng" /></label>
          <label style={labelStyle}>Số điện thoại<input style={inputStyle} value={form.customerPhone} onChange={(e) => updateForm('customerPhone', e.target.value)} placeholder="Số điện thoại" /></label>
        </div>
        <label style={{ ...labelStyle, marginTop: 12 }}>Địa chỉ công trình<input style={inputStyle} value={form.customerAddress} onChange={(e) => updateForm('customerAddress', e.target.value)} placeholder="Địa chỉ giao hàng / công trình" /></label>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={panelTitleStyle}>Danh sách hạng mục cửa</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item, index) => (
            <div key={index} style={{ border: `1px solid ${ui.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 10 }}>
                <label style={labelStyle}>Ký hiệu<select style={inputStyle} value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)}>{QUOTE_NAMES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={labelStyle}>Hệ nhôm<select style={inputStyle} value={item.system} onChange={(e) => updateItem(index, 'system', e.target.value)}>{getSystemOptions(item.name, item.color).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={labelStyle}>Loại cửa<select style={inputStyle} value={item.doorType} onChange={(e) => updateItem(index, 'doorType', e.target.value)}>{getDoorTypeOptions(item.name, item.system).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={labelStyle}>Màu<select style={inputStyle} value={item.color} onChange={(e) => updateItem(index, 'color', e.target.value)}><option value="">Chọn màu</option>{COLORS.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr) auto', gap: 10, marginTop: 10, alignItems: 'end' }}>
                <label style={labelStyle}>Rộng mm<input style={inputStyle} type="number" value={item.widthMm} onChange={(e) => updateItem(index, 'widthMm', e.target.value)} /></label>
                <label style={labelStyle}>Cao mm<input style={inputStyle} type="number" value={item.heightMm} onChange={(e) => updateItem(index, 'heightMm', e.target.value)} /></label>
                <label style={labelStyle}>Số lượng<input style={inputStyle} type="number" value={item.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} /></label>
                <label style={labelStyle}>Đơn giá/m2<input style={inputStyle} type="number" value={item.pricePerM2} onChange={(e) => updateItem(index, 'pricePerM2', e.target.value)} /></label>
                <label style={labelStyle}>Kính<select style={inputStyle} value={item.glassType} onChange={(e) => updateItem(index, 'glassType', e.target.value)}><option value="">Chọn kính</option>{GLASS_TYPES.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <button onClick={() => setItems((current) => current.filter((_, idx) => idx !== index))} style={{ border: `1px solid ${ui.border}`, background: ui.surface, color: ui.danger, borderRadius: 8, padding: 10, cursor: 'pointer' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setItems((current) => [...current, { ...defaultItem }])} style={{ ...primaryButtonStyle, marginTop: 12, background: ui.surface, color: ui.brand, border: `1px solid ${ui.border}` }}><Plus size={16} /> Thêm hạng mục</button>
      </section>

      <section style={{ ...panelStyle, marginTop: 18 }}>
        <h2 style={panelTitleStyle}>Phụ kiện và sản phẩm gia tăng</h2>
        {extras.map((item, index) => (
          <div key={index} style={{ display: 'grid', gridTemplateColumns: '1.5fr 0.7fr 0.7fr 1fr auto', gap: 10, marginBottom: 10, alignItems: 'end' }}>
            <label style={labelStyle}>Tên phụ kiện<input style={inputStyle} value={item.name} onChange={(e) => updateExtra(index, 'name', e.target.value)} placeholder="Tay nắm, khóa, phào..." /></label>
            <label style={labelStyle}>Đơn vị<input style={inputStyle} value={item.unit} onChange={(e) => updateExtra(index, 'unit', e.target.value)} /></label>
            <label style={labelStyle}>Số lượng<input style={inputStyle} type="number" value={item.quantity} onChange={(e) => updateExtra(index, 'quantity', e.target.value)} /></label>
            <label style={labelStyle}>Đơn giá<input style={inputStyle} type="number" value={item.unitPrice} onChange={(e) => updateExtra(index, 'unitPrice', e.target.value)} /></label>
            <button onClick={() => setExtras((current) => current.filter((_, idx) => idx !== index))} style={{ border: `1px solid ${ui.border}`, background: ui.surface, color: ui.danger, borderRadius: 8, padding: 10, cursor: 'pointer' }}><Trash2 size={16} /></button>
          </div>
        ))}
        <button onClick={() => setExtras((current) => [...current, { name: '', unit: 'bộ', quantity: 1, unitPrice: 0 }])} style={{ ...primaryButtonStyle, background: ui.surface, color: ui.brand, border: `1px solid ${ui.border}` }}><Plus size={16} /> Thêm phụ kiện</button>
      </section>

      {result ? (
        <section style={{ ...panelStyle, marginTop: 18, overflowX: 'auto' }}>
          <h2 style={panelTitleStyle}>Bảng xem trước</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>{['STT', 'Ký hiệu', 'Loại cửa', 'Rộng', 'Cao', 'SL', 'Đơn giá', 'Thành tiền'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {result.items.map((item, index) => (
                <tr key={index}>
                  <td style={tableCellStyle}>{index + 1}</td>
                  <td style={tableCellStyle}>{item.name}</td>
                  <td style={tableCellStyle}>{item.doorType}</td>
                  <td style={tableCellStyle}>{item.widthMm}</td>
                  <td style={tableCellStyle}>{item.heightMm}</td>
                  <td style={tableCellStyle}>{item.quantity}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(item.pricePerM2)}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>{currency(item.totalPrice)}</td>
                </tr>
              ))}
              {(result.extraProducts || []).map((item, index) => (
                <tr key={`extra-${index}`} style={{ background: ui.brandSoft }}>
                  <td style={tableCellStyle}></td>
                  <td style={tableCellStyle}>{item.name}</td>
                  <td style={tableCellStyle}>Phụ kiện / gia tăng</td>
                  <td style={tableCellStyle}></td>
                  <td style={tableCellStyle}></td>
                  <td style={tableCellStyle}>{item.quantity} {item.unit}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(item.unitPrice)}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>{currency(item.totalPrice || item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <h2 style={{ margin: 0, color: ui.text }}>Tổng cộng: <span style={{ color: ui.danger }}>{currency(result.totalAmount)}</span></h2>
          </div>
        </section>
      ) : null}
    </div>
  );
}
