'use client';

import { useCallback, useEffect, useState } from 'react';
import { colors } from '@eurohouse/ui';
import { AdminShell } from '../../src/AdminShell';
import { LoginScreen, apiUrl, useDemoAuth } from '../../src/auth';

type ApiOrder = {
  id: string;
  code: string;
  sourceType: string;
  factoryName: string;
  dealerName: string;
  nppName: string;
  customerName: string;
  deliveryAddress: string;
  status: string;
  totalKg: number;
  totalAmount: number;
  items: { productCode: string; productName: string; quantity: number; totalKg: number; colorCode: string }[];
  histories: { status: string; title: string; note: string; actor: string; createdAt: string }[];
};

const statusMeta: Record<string, { label: string; color: string }> = {
  NEW: { label: 'Mới', color: colors.brandOrange },
  RECEIVED_BY_NPP: { label: 'NPP tiếp nhận', color: colors.success },
  SENT_TO_ADMIN: { label: 'Gửi công ty', color: colors.brandBlack },
  PROCESSING: { label: 'Đang xử lý', color: colors.warning },
  PARTIAL: { label: 'Giao một phần', color: colors.warning },
  COMPLETED: { label: 'Hoàn tất', color: colors.success },
  CANCELLED: { label: 'Đã hủy', color: colors.danger },
  OVERDUE: { label: 'Chậm xử lý', color: colors.danger },
};

const nextActions: { status: string; label: string }[] = [
  { status: 'PROCESSING', label: 'Bắt đầu xử lý' },
  { status: 'PARTIAL', label: 'Giao một phần' },
  { status: 'COMPLETED', label: 'Hoàn tất' },
  { status: 'CANCELLED', label: 'Hủy đơn' },
];

export default function OrdersPage() {
  const { user, ready, login, logout } = useDemoAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    fetch(`${apiUrl}/admin/orders`)
      .then((response) => response.json())
      .then((data: ApiOrder[]) => {
        setOrders(data);
        setSelected((current) => (current ? data.find((order) => order.id === current.id) ?? data[0] ?? null : data[0] ?? null));
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Không tải được đơn hàng'));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  async function updateStatus(order: ApiOrder, status: string) {
    setMessage('');
    await fetch(`${apiUrl}/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, actor: 'Công ty', title: statusMeta[status]?.label ?? status }),
    });
    setMessage(`Đã cập nhật đơn ${order.code}.`);
    load();
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={{ color: colors.brandOrange, fontWeight: 900, margin: 0 }}>ĐƠN HÀNG</p>
      <h1 style={{ fontSize: 34, margin: '8px 0', color: colors.brandBlack }}>Luồng đơn: Xưởng → NPP → Công ty</h1>
      <p style={{ color: colors.brandGrey }}>Theo dõi toàn bộ đơn hàng và xử lý trực tiếp tại đây.</p>
      {message ? <p style={{ color: colors.success, fontWeight: 700 }}>{message}</p> : null}

      {orders.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 16, textAlign: 'center', padding: 48, color: colors.brandGrey }}>
          Chưa có đơn hàng nào. Đơn từ app Thợ/NPP sẽ xuất hiện ở đây.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 16, alignItems: 'start' }}>
          <div style={panelStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Mã đơn', 'Nguồn', 'NPP', 'Giá trị', 'Trạng thái'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr></thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} onClick={() => setSelected(order)} style={{ cursor: 'pointer', background: selected?.id === order.id ? colors.orangeSoft : 'transparent' }}>
                      <td style={tableCellStyle}>{order.code}</td>
                      <td style={tableCellStyle}>{order.sourceType}</td>
                      <td style={tableCellStyle}>{order.nppName || '—'}</td>
                      <td style={tableCellStyle}>{(order.totalAmount / 1000000).toFixed(1)} tr</td>
                      <td style={tableCellStyle}><span style={{ color: statusMeta[order.status]?.color, fontWeight: 900 }}>{statusMeta[order.status]?.label ?? order.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panelStyle}>
            {selected ? (
              <>
                <h2 style={{ margin: '0 0 4px', color: colors.brandBlack }}>{selected.code}</h2>
                <p style={{ margin: 0, color: colors.brandGrey }}>{selected.customerName || '—'} · {selected.deliveryAddress || '—'}</p>
                <div style={{ display: 'flex', gap: 16, margin: '14px 0' }}>
                  <div><small style={{ color: colors.brandGrey }}>Tổng kg</small><p style={{ margin: 0, fontWeight: 900 }}>{selected.totalKg.toFixed(1)} kg</p></div>
                  <div><small style={{ color: colors.brandGrey }}>Giá trị</small><p style={{ margin: 0, fontWeight: 900 }}>{selected.totalAmount.toLocaleString('vi-VN')} đ</p></div>
                </div>

                <h3 style={{ color: colors.brandBlack, fontSize: 15 }}>Chi tiết hàng</h3>
                {selected.items.map((item, idx) => (
                  <div key={`${item.productCode}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${colors.orangeSoft}` }}>
                    <span>{item.productName} ×{item.quantity}</span>
                    <span style={{ color: colors.brandGrey }}>{item.totalKg.toFixed(1)} kg</span>
                  </div>
                ))}

                <h3 style={{ color: colors.brandBlack, fontSize: 15, marginTop: 16 }}>Lịch sử xử lý</h3>
                {selected.histories.map((event, index) => (
                  <div key={index} style={{ padding: '6px 0' }}>
                    <strong style={{ color: statusMeta[event.status]?.color ?? colors.brandOrange }}>● {event.title}</strong>
                    <p style={{ margin: '2px 0 0', color: colors.brandGrey, fontSize: 13 }}>{event.note} · {event.actor}</p>
                  </div>
                ))}

                <h3 style={{ color: colors.brandBlack, fontSize: 15, marginTop: 16 }}>Xử lý đơn</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {nextActions.map((action) => (
                    <button key={action.status} onClick={() => updateStatus(selected, action.status)} style={{ border: `1px solid ${colors.brandOrange}`, background: colors.white, color: colors.brandBlack, borderRadius: 999, padding: '8px 14px', fontWeight: 700, cursor: 'pointer' }}>
                      {action.label}
                    </button>
                  ))}
                </div>
              </>
            ) : <p style={{ color: colors.brandGrey }}>Chọn một đơn để xem chi tiết.</p>}
          </div>
        </div>
      )}
    </AdminShell>
  );
}

const panelStyle = { border: `1px solid ${colors.orangeSoft}`, borderRadius: 20, padding: 22, background: colors.white, boxShadow: '0 10px 26px rgba(21,17,16,0.05)' };
const tableHeadStyle = { textAlign: 'left' as const, padding: 12, color: colors.brandGrey, borderBottom: `1px solid ${colors.orangeSoft}` };
const tableCellStyle = { padding: 12, borderBottom: `1px solid ${colors.orangeSoft}`, color: colors.brandBlack };
