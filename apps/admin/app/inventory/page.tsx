'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileCheck2, PackageCheck, RefreshCw, Send, Warehouse } from 'lucide-react';
import type { CreateAdminToNppShipmentInput } from '@eurohouse/types';
import { AdminShell } from '../../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../../src/auth';
import { apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type PendingOrderItem = { id: string; productCode: string; productName: string; colorCode: string; quantity: number; totalKg: number; totalPrice: number; profile?: { code?: string } | null };
type PendingNppOrder = {
  id: string; code: string; poNo: string; sourceType: string; status: string; nppName: string; customerName: string;
  note: string; createdAt: string; totalKg: number; totalAmount: number; items: PendingOrderItem[];
};
const ELIGIBLE_STATUSES = new Set(['NEW', 'CONFIRMED', 'PROCESSING']);

function pendingNppOrders(orders: PendingNppOrder[]) {
  return orders.filter((order) => order.sourceType === 'NPP_TO_ADMIN' && ELIGIBLE_STATUSES.has(order.status));
}

export default function InventoryPage() {
  const { user, ready, login, logout } = useDemoAuth();
  const [orders, setOrders] = useState<PendingNppOrder[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [actualTotalKg, setActualTotalKg] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const pending = pendingNppOrders(await apiGet<PendingNppOrder[]>('/admin/orders'));
      setOrders(pending);
      setSelectedId((current) => pending.some((order) => order.id === current) ? current : pending[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được danh sách PO đang chờ.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (user) void load(); }, [user, load]);
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const totals = useMemo(() => ({
    bars: selected?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
    kg: selected?.items.reduce((sum, item) => sum + Number(item.totalKg || 0), 0) || selected?.totalKg || 0,
    amount: selected?.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0) || selected?.totalAmount || 0,
  }), [selected]);
  useEffect(() => { setActualTotalKg(selected && totals.kg > 0 ? totals.kg.toFixed(2) : ''); setNote(''); }, [selectedId, selected, totals.kg]);

  async function createShipment() {
    if (!selected) { setError('Chọn một PO đang chờ giao.'); return; }
    setSubmitting(true); setError(''); setMessage('');
    const body: CreateAdminToNppShipmentInput = {
      sourceOrderId: selected.id,
      actualTotalKg: Number(actualTotalKg) > 0 ? Number(actualTotalKg) : undefined,
      note: note.trim() || undefined,
    };
    try {
      const created = await apiSend<{ code: string; invoiceNo: string }>('/admin/npp-shipments', 'POST', body);
      setMessage(`Đã tạo phiếu giao ${created.invoiceNo || created.code} từ PO ${selected.poNo || selected.code}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được phiếu giao NPP.');
    } finally { setSubmitting(false); }
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;
  return (
    <AdminShell user={user} onLogout={logout}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <p style={eyebrowStyle}>Kho NVL · Giao hàng NPP</p>
          <h1 style={pageTitleStyle}>Tạo phiếu giao từ PO của NPP</h1>
          <p style={{ ...subtitleStyle, maxWidth: 760 }}>Chọn đúng đơn NPP đã gửi. Hệ thống tự khóa NPP, PO, danh sách hàng và tự sinh số hóa đơn khi tạo phiếu.</p>
        </div>
        <button onClick={() => void load()} disabled={loading} style={{ ...primaryButtonStyle, background: ui.surface, color: ui.text, border: `1px solid ${ui.border}` }}>
          <RefreshCw size={15} /> {loading ? 'Đang tải...' : 'Làm mới PO'}
        </button>
      </div>
      {message ? <p style={{ color: ui.success, fontWeight: 750, background: ui.successSoft, padding: '10px 14px', borderRadius: 12 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 750, background: '#fff1f0', padding: '10px 14px', borderRadius: 12 }}>{error}</p> : null}

      {orders.length === 0 && !loading ? (
        <section style={{ ...panelStyle, marginTop: 20, textAlign: 'center', padding: '48px 24px' }}>
          <PackageCheck size={38} color={ui.brand} />
          <h2 style={{ margin: '14px 0 8px', color: ui.text }}>Không có PO đang chờ giao</h2>
          <p style={{ color: ui.textMuted, margin: 0 }}>Khi NPP gửi đơn đặt hàng, PO sẽ xuất hiện tại đây để công ty lập phiếu giao.</p>
        </section>
      ) : (
        <>
          <div className="shipment-grid" style={{ marginTop: 20 }}>
            <section style={panelStyle}>
              <h2 style={{ margin: '0 0 16px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><Warehouse size={18} color={ui.brand} /> Đơn NPP đang chờ</h2>
              <label style={labelStyle}>Chọn PO
                <select style={inputStyle} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {orders.map((order) => <option key={order.id} value={order.id}>{order.poNo || order.code} · {order.nppName || order.customerName}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <ReadOnlyField label="Nhà phân phối" value={selected?.nppName || selected?.customerName || '—'} />
                <ReadOnlyField label="Số PO" value={selected?.poNo || selected?.code || '—'} accent />
                <ReadOnlyField label="Số hóa đơn" value="Tự động sinh khi tạo phiếu" accent />
              </div>
            </section>
            <section style={panelStyle}>
              <h2 style={{ margin: '0 0 16px', color: ui.text, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><FileCheck2 size={18} color={ui.brand} /> Xác nhận xuất kho</h2>
              <div className="confirm-grid">
                <label style={labelStyle}>Kg thực cân toàn phiếu<input style={inputStyle} type="number" min="0" step="0.01" value={actualTotalKg} onChange={(event) => setActualTotalKg(event.target.value)} /></label>
                <label style={labelStyle}>Ghi chú giao hàng<input style={inputStyle} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ví dụ: Giao đợt 1 tại kho NPP" /></label>
              </div>
              <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: ui.brandSoft, color: ui.text, lineHeight: 1.55 }}>
                <strong>{totals.bars.toLocaleString('vi-VN')} cây</strong> · {totals.kg.toFixed(2)} kg tạm tính · <strong>{currency(totals.amount)}</strong>
              </div>
            </section>
          </div>
          <section style={{ ...panelStyle, marginTop: 18, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px 10px' }}><strong style={{ color: ui.text }}>Danh sách hàng theo PO — chỉ đọc</strong></div>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead><tr>{['Mã thanh', 'Tên hàng', 'Màu', 'Số cây', 'Kg tạm tính', 'Giá trị tạm tính'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr></thead>
              <tbody>{selected?.items.map((item) => <tr key={item.id}>
                <td style={{ ...tableCellStyle, fontWeight: 800 }}>{item.profile?.code || item.productCode}</td><td style={tableCellStyle}>{item.productName}</td>
                <td style={tableCellStyle}>{item.colorCode || '—'}</td><td style={tableCellStyle}>{item.quantity.toLocaleString('vi-VN')}</td>
                <td style={tableCellStyle}>{Number(item.totalKg || 0).toFixed(2)} kg</td><td style={tableCellStyle}>{currency(Number(item.totalPrice || 0))}</td>
              </tr>)}</tbody>
            </table></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 18, borderTop: `1px solid ${ui.border}` }}>
              <button onClick={() => void createShipment()} disabled={!selected || submitting} style={{ ...primaryButtonStyle, opacity: !selected || submitting ? 0.6 : 1 }}>
                <Send size={15} /> {submitting ? 'Đang tạo phiếu...' : 'Tạo phiếu giao & sinh hóa đơn'}
              </button>
            </div>
          </section>
        </>
      )}
      <style jsx>{`.shipment-grid{display:grid;grid-template-columns:minmax(300px,.9fr) minmax(420px,1.35fr);gap:18px;align-items:start}.confirm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:12px}@media(max-width:900px){.shipment-grid{grid-template-columns:1fr}}@media(max-width:560px){.confirm-grid{grid-template-columns:1fr}}`}</style>
    </AdminShell>
  );
}

function ReadOnlyField({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: '11px 13px', background: ui.surfaceMuted }}>
    <div style={{ color: ui.textMuted, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{label}</div>
    <div style={{ color: accent ? ui.brand : ui.text, fontWeight: 800, overflowWrap: 'anywhere' }}>{value}</div>
  </div>;
}
