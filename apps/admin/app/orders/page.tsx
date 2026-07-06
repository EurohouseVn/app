'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, PackageX, PlayCircle, Truck } from 'lucide-react';
import { AdminShell } from '../../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../../src/auth';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

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

const statusMeta: Record<string, { label: string; fg: string; soft: string }> = {
  NEW: { label: 'Mới', fg: ui.brand, soft: ui.brandSoft },
  RECEIVED_BY_NPP: { label: 'NPP tiếp nhận', fg: ui.success, soft: ui.successSoft },
  SENT_TO_ADMIN: { label: 'Gửi công ty', fg: ui.blue, soft: ui.blueSoft },
  PROCESSING: { label: 'Đang xử lý', fg: ui.warning, soft: ui.warningSoft },
  PARTIAL: { label: 'Giao một phần', fg: ui.warning, soft: ui.warningSoft },
  COMPLETED: { label: 'Hoàn tất', fg: ui.success, soft: ui.successSoft },
  CANCELLED: { label: 'Đã hủy', fg: ui.danger, soft: ui.dangerSoft },
  OVERDUE: { label: 'Chậm xử lý', fg: ui.danger, soft: ui.dangerSoft },
};

const nextActions: { status: string; label: string; icon: typeof PlayCircle }[] = [
  { status: 'PROCESSING', label: 'Bắt đầu xử lý', icon: PlayCircle },
  { status: 'PARTIAL', label: 'Giao một phần', icon: Truck },
  { status: 'COMPLETED', label: 'Hoàn tất', icon: CheckCircle2 },
  { status: 'CANCELLED', label: 'Hủy đơn', icon: PackageX },
];

function StatusChip({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, fg: ui.text, soft: ui.surfaceMuted };
  return (
    <span style={{ background: meta.soft, color: meta.fg, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 }}>
      {meta.label}
    </span>
  );
}

export default function OrdersPage() {
  const { user, ready, login, logout } = useDemoAuth();
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(() => {
    apiGet<ApiOrder[]>('/admin/orders')
      .then((data) => {
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
    await apiSend(`/orders/${order.id}/status`, 'PATCH', {
      status,
      actor: 'Công ty',
      title: statusMeta[status]?.label ?? status,
    });
    setMessage(`Đã cập nhật đơn ${order.code}.`);
    load();
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={eyebrowStyle}>ĐƠN HÀNG</p>
      <h1 style={pageTitleStyle}>Luồng đơn: Xưởng → NPP → Công ty</h1>
      <p style={subtitleStyle}>Theo dõi toàn bộ đơn hàng và xử lý trực tiếp tại đây.</p>
      {message ? (
        <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>
          {message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 16, textAlign: 'center', padding: 48, color: ui.textFaint }}>
          Chưa có đơn hàng nào. Đơn từ app Thợ/NPP sẽ xuất hiện ở đây.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 16, alignItems: 'start' }}>
          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Mã đơn', 'Nguồn', 'NPP', 'Giá trị', 'Trạng thái'].map((head) => (
                      <th key={head} style={tableHeadStyle}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelected(order)}
                      style={{ cursor: 'pointer', background: selected?.id === order.id ? ui.brandSoft : 'transparent' }}
                    >
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{order.code}</td>
                      <td style={tableCellStyle}>{order.sourceType}</td>
                      <td style={tableCellStyle}>{order.nppName || '—'}</td>
                      <td style={tableCellStyle}>{(order.totalAmount / 1000000).toFixed(1)} tr</td>
                      <td style={tableCellStyle}>
                        <StatusChip status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={panelStyle}>
            {selected ? (
              <>
                <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 19, fontWeight: 800 }}>{selected.code}</h2>
                <p style={{ margin: 0, color: ui.textMuted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={13} /> {selected.customerName || '—'} · {selected.deliveryAddress || '—'}
                </p>
                <div style={{ display: 'flex', gap: 24, margin: '16px 0' }}>
                  <div>
                    <small style={{ color: ui.textFaint }}>Tổng kg</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{selected.totalKg.toFixed(1)} kg</p>
                  </div>
                  <div>
                    <small style={{ color: ui.textFaint }}>Giá trị</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{selected.totalAmount.toLocaleString('vi-VN')} đ</p>
                  </div>
                </div>

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700 }}>Chi tiết hàng</h3>
                {selected.items.map((item, idx) => (
                  <div key={`${item.productCode}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 13 }}>
                    <span style={{ color: ui.text }}>
                      {item.productName} ×{item.quantity}
                    </span>
                    <span style={{ color: ui.textFaint }}>{item.totalKg.toFixed(1)} kg</span>
                  </div>
                ))}

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} /> Lịch sử xử lý
                </h3>
                {selected.histories.map((event, index) => {
                  const meta = statusMeta[event.status] ?? { label: event.title, fg: ui.brand };
                  return (
                    <div key={index} style={{ padding: '7px 0', fontSize: 13 }}>
                      <strong style={{ color: meta.fg }}>● {event.title}</strong>
                      <p style={{ margin: '2px 0 0', color: ui.textFaint }}>
                        {event.note} · {event.actor}
                      </p>
                    </div>
                  );
                })}

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 18 }}>Xử lý đơn</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {nextActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.status}
                        onClick={() => updateStatus(selected, action.status)}
                        style={{
                          border: `1px solid ${ui.borderStrong}`,
                          background: ui.surface,
                          color: ui.text,
                          borderRadius: 10,
                          padding: '8px 14px',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Icon size={14} /> {action.label}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ color: ui.textFaint }}>Chọn một đơn để xem chi tiết.</p>
            )}
          </div>
        </div>
      )}
    </AdminShell>
  );
}
