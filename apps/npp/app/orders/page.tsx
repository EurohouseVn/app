'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Send } from 'lucide-react';
import type { PaginatedOrders } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { eyebrowStyle, ghostButtonStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type ApiOrder = {
  id: string;
  code: string;
  sourceType: string;
  factoryName: string;
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

const statusFilters: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'RECEIVED_BY_NPP', label: 'Đã tiếp nhận' },
  { key: 'SENT_TO_ADMIN', label: 'Đã gửi công ty' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function StatusChip({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, fg: ui.text, soft: ui.surfaceMuted };
  return (
    <span style={{ background: meta.soft, color: meta.fg, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 }}>
      {meta.label}
    </span>
  );
}

export default function NppOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [message, setMessage] = useState('');
  const pageSize = 10;

  const load = useCallback((targetPage: number, targetStatus: string) => {
    const query = `?page=${targetPage}&pageSize=${pageSize}${targetStatus !== 'ALL' ? `&status=${targetStatus}` : ''}`;
    apiGet<PaginatedOrders<ApiOrder>>(`/npp/orders${query}`)
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
        setPage(res.page);
        setSelected((current) => (current ? res.items.find((o) => o.id === current.id) ?? res.items[0] ?? null : res.items[0] ?? null));
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Không tải được đơn hàng.'));
  }, []);

  useEffect(() => { load(1, status); }, [load, status]);

  async function receive(order: ApiOrder) {
    setMessage('');
    await apiSend(`/npp/orders/${order.id}/receive`, 'POST');
    setMessage(`Đã tiếp nhận đơn ${order.code}.`);
    load(page, status);
  }

  async function sendAdmin(order: ApiOrder) {
    setMessage('');
    await apiSend(`/npp/orders/${order.id}/send-admin`, 'POST');
    setMessage(`Đã gửi đơn ${order.code} lên công ty.`);
    load(page, status);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <NppPage>
      <p style={eyebrowStyle}>ĐƠN HÀNG</p>
      <h1 style={pageTitleStyle}>Đơn hàng từ Xưởng</h1>
      <p style={subtitleStyle}>Tiếp nhận đơn từ Xưởng và chuyển lên công ty khi đã sẵn sàng.</p>
      {message ? (
        <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>
          {message}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px' }}>
        {statusFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setStatus(f.key)}
            style={{ ...ghostButtonStyle, background: status === f.key ? ui.brandSoft : ui.surface, color: status === f.key ? ui.brandText : ui.text, borderColor: status === f.key ? ui.brand : ui.borderStrong }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 16, textAlign: 'center', padding: 48, color: ui.textFaint }}>
          Chưa có đơn hàng nào ở trạng thái này.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, marginTop: 4, alignItems: 'start' }}>
          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Mã đơn', 'Xưởng', 'Giá trị', 'Trạng thái'].map((head) => (
                      <th key={head} style={tableHeadStyle}>{head}</th>
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
                      <td style={tableCellStyle}>{order.factoryName || '—'}</td>
                      <td style={tableCellStyle}>{(order.totalAmount / 1000000).toFixed(1)} tr</td>
                      <td style={tableCellStyle}><StatusChip status={order.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderTop: `1px solid ${ui.border}` }}>
                <button disabled={page <= 1} onClick={() => load(page - 1, status)} style={{ ...ghostButtonStyle, opacity: page <= 1 ? 0.5 : 1 }}>Trang trước</button>
                <span style={{ color: ui.textMuted, fontSize: 13 }}>{page}/{totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => load(page + 1, status)} style={{ ...ghostButtonStyle, opacity: page >= totalPages ? 0.5 : 1 }}>Trang sau</button>
              </div>
            ) : null}
          </div>

          <div style={panelStyle}>
            {selected ? (
              <>
                <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 19, fontWeight: 800 }}>{selected.code}</h2>
                <p style={{ margin: 0, color: ui.textMuted, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MapPin size={13} /> {selected.factoryName || '—'}
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
                    <span style={{ color: ui.text }}>{item.productName} ×{item.quantity}</span>
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
                      <p style={{ margin: '2px 0 0', color: ui.textFaint }}>{event.note} · {event.actor}</p>
                    </div>
                  );
                })}

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 18 }}>Xử lý đơn</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selected.status === 'NEW' ? (
                    <button
                      onClick={() => receive(selected)}
                      style={{ border: `1px solid ${ui.borderStrong}`, background: ui.surface, color: ui.text, borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <CheckCircle2 size={14} /> Tiếp nhận
                    </button>
                  ) : null}
                  {selected.status === 'RECEIVED_BY_NPP' ? (
                    <button
                      onClick={() => sendAdmin(selected)}
                      style={{ border: `1px solid ${ui.borderStrong}`, background: ui.surface, color: ui.text, borderRadius: 10, padding: '8px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Send size={14} /> Gửi công ty
                    </button>
                  ) : null}
                  {selected.status !== 'NEW' && selected.status !== 'RECEIVED_BY_NPP' ? (
                    <p style={{ color: ui.textFaint, fontSize: 13 }}>Đơn đã chuyển sang công ty xử lý.</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p style={{ color: ui.textFaint }}>Chọn một đơn để xem chi tiết.</p>
            )}
          </div>
        </div>
      )}
    </NppPage>
  );
}
