'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackageMinus, PackagePlus, TriangleAlert, Warehouse } from 'lucide-react';
import type { CreateStockMovementInput, MaterialItem, StockMovementItem } from '@eurohouse/types';
import { AdminPage } from '../../src/AdminPage';
import { apiGet, apiSend } from '../../src/lib/api';
import {
  chipStyle,
  currency,
  eyebrowStyle,
  ghostButtonStyle,
  inputStyle,
  labelStyle,
  pageTitleStyle,
  panelStyle,
  primaryButtonStyle,
  subtitleStyle,
  tableCellStyle,
  tableHeadStyle,
  ui,
} from '../../src/ui';

const categoryLabel: Record<string, string> = { DIRECT_MATERIAL: 'Vật liệu trực tiếp', OVERHEAD: 'Chi phí sản xuất chung' };
const groupLabel: Record<string, string> = {
  BILLET: 'Billet nhôm', PAINT: 'Sơn tĩnh điện', LABEL: 'Tem nhãn', NYLON: 'Nilong bọc',
  PACKAGING: 'Bao bì / thùng carton', ACCESSORY_HW: 'Phụ kiện',
  ELECTRICITY: 'Điện sản xuất', GAS: 'Gas / LPG', WATER: 'Nước', FUEL: 'Nhiên liệu máy', MAINTENANCE: 'Bảo trì thiết bị',
};

export default function InventoryPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [movements, setMovements] = useState<StockMovementItem[]>([]);
  const [category, setCategory] = useState<'ALL' | 'DIRECT_MATERIAL' | 'OVERHEAD'>('ALL');
  const [selected, setSelected] = useState<MaterialItem | null>(null);
  const [form, setForm] = useState({ direction: 'IN' as 'IN' | 'OUT', quantity: '', unitPrice: '', reason: '', note: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiGet<MaterialItem[]>('/materials').then(setMaterials).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được kho NVL.'));
    apiGet<StockMovementItem[]>('/stock-movements').then(setMovements).catch(() => undefined);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => materials.filter((m) => category === 'ALL' || m.category === category), [materials, category]);
  const lowStockCount = materials.filter((m) => m.lowStockAlert > 0 && m.stockQty < m.lowStockAlert).length;
  const directValue = materials.filter((m) => m.category === 'DIRECT_MATERIAL').reduce((s, m) => s + m.stockQty * m.unitPrice, 0);

  async function submitMovement() {
    if (!selected) return;
    setError('');
    const quantity = Number(form.quantity);
    if (!quantity || quantity <= 0) {
      setError('Nhập số lượng hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateStockMovementInput = {
        materialId: selected.id, direction: form.direction, quantity,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
        reason: form.reason || undefined, note: form.note || undefined,
      };
      await apiSend('/stock-movements', 'POST', input);
      setMessage(`Đã ${form.direction === 'IN' ? 'nhập' : 'xuất'} ${quantity} ${selected.unit} ${selected.name}.`);
      setForm({ direction: 'IN', quantity: '', unitPrice: '', reason: '', note: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi được phiếu kho.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>KHO NVL</p>
      <h1 style={pageTitleStyle}>Kho nguyên vật liệu</h1>
      <p style={subtitleStyle}>Theo dõi tồn kho vật liệu trực tiếp và chi phí sản xuất chung, nhập/xuất trực tiếp tại đây.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, margin: '12px 0 20px' }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <Warehouse size={18} color={ui.teal} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng số vật tư</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{materials.length}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <TriangleAlert size={18} color={lowStockCount > 0 ? ui.danger : ui.textFaint} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tồn thấp cần nhập thêm</small>
          <strong style={{ display: 'block', fontSize: 22, color: lowStockCount > 0 ? ui.danger : ui.text }}>{lowStockCount}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <PackagePlus size={18} color={ui.brand} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Giá trị tồn vật liệu trực tiếp</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(directValue)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['ALL', 'DIRECT_MATERIAL', 'OVERHEAD'] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{ ...ghostButtonStyle, background: category === c ? ui.brandSoft : ui.surface, color: category === c ? ui.brandText : ui.text, borderColor: category === c ? ui.brand : ui.borderStrong }}
          >
            {c === 'ALL' ? 'Tất cả' : categoryLabel[c]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Mã', 'Tên', 'Nhóm', 'Đơn vị', 'Tồn hiện tại', 'Đơn giá'].map((head) => (
                    <th key={head} style={tableHeadStyle}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => {
                  const low = m.lowStockAlert > 0 && m.stockQty < m.lowStockAlert;
                  return (
                    <tr key={m.id} onClick={() => setSelected(m)} style={{ cursor: 'pointer', background: selected?.id === m.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{m.code}</td>
                      <td style={tableCellStyle}>{m.name}</td>
                      <td style={tableCellStyle}>{groupLabel[m.group] ?? m.group}</td>
                      <td style={tableCellStyle}>{m.unit}</td>
                      <td style={tableCellStyle}>
                        <span style={low ? chipStyle('danger') : undefined}>{m.stockQty.toLocaleString('vi-VN')}</span>
                      </td>
                      <td style={tableCellStyle}>{currency(m.unitPrice)}</td>
                    </tr>
                  );
                })}
                {visible.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có vật tư nào.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          {selected ? (
            <>
              <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected.name}</h2>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>{selected.code} · {groupLabel[selected.group] ?? selected.group}</p>
              <div style={{ display: 'flex', gap: 24, margin: '14px 0' }}>
                <div>
                  <small style={{ color: ui.textFaint }}>Tồn hiện tại</small>
                  <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 18 }}>{selected.stockQty.toLocaleString('vi-VN')} {selected.unit}</p>
                </div>
                <div>
                  <small style={{ color: ui.textFaint }}>Đơn giá</small>
                  <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 18 }}>{currency(selected.unitPrice)}</p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={() => setForm((f) => ({ ...f, direction: 'IN' }))} style={{ ...ghostButtonStyle, flex: 1, justifyContent: 'center', background: form.direction === 'IN' ? ui.successSoft : ui.surface, color: form.direction === 'IN' ? ui.success : ui.text }}>
                  <PackagePlus size={14} /> Nhập kho
                </button>
                <button onClick={() => setForm((f) => ({ ...f, direction: 'OUT' }))} style={{ ...ghostButtonStyle, flex: 1, justifyContent: 'center', background: form.direction === 'OUT' ? ui.dangerSoft : ui.surface, color: form.direction === 'OUT' ? ui.danger : ui.text }}>
                  <PackageMinus size={14} /> Xuất kho
                </button>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <label style={labelStyle}>
                  Số lượng ({selected.unit})
                  <input style={inputStyle} type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Đơn giá (để trống dùng giá tham chiếu)
                  <input style={inputStyle} type="number" value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Lý do
                  <input style={inputStyle} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Mua NVL, hao hụt, ..." />
                </label>
              </div>
              <button onClick={submitMovement} disabled={submitting} style={{ ...primaryButtonStyle, width: '100%', marginTop: 14 }}>
                {submitting ? 'Đang lưu...' : 'Ghi nhận phiếu'}
              </button>

              <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 20 }}>Lịch sử gần đây</h3>
              {movements.filter((m) => m.materialId === selected.id).slice(0, 6).map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 13 }}>
                  <span style={{ color: m.direction === 'IN' ? ui.success : ui.danger, fontWeight: 700 }}>{m.direction === 'IN' ? '+' : '-'}{m.quantity} {selected.unit}</span>
                  <span style={{ color: ui.textFaint }}>{m.reason || '—'}</span>
                </div>
              ))}
            </>
          ) : (
            <p style={{ color: ui.textFaint }}>Chọn một vật tư để nhập/xuất kho.</p>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
