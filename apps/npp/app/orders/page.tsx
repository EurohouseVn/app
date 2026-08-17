'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, FileSpreadsheet, FileText, MapPin, PackageOpen, Printer, Truck, UserRound } from 'lucide-react';
import type { PaginatedOrders } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiBlob, apiGet, apiSend } from '../../src/lib/api';
import { currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

type ApiOrder = {
  id: string;
  code: string;
  sourceType: string;
  factoryName: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  note?: string;
  accessoriesNote?: string;
  status: string;
  totalKg: number;
  totalAmount: number;
  createdAt?: string;
  createdBy?: {
    displayName: string;
    phone?: string;
    email?: string;
    organization?: { name?: string; address?: string; phone?: string; email?: string };
  };
  items: { productCode: string; productName: string; quantity: number; totalKg: number; colorCode: string; totalPrice?: number }[];
  histories: { status: string; title: string; note: string; actor: string; createdAt: string }[];
};

const statusMeta: Record<string, { label: string; fg: string; soft: string }> = {
  NEW: { label: 'Mới', fg: ui.brand, soft: ui.brandSoft },
  NPP_REVIEWING: { label: 'NPP tiếp nhận', fg: ui.success, soft: ui.successSoft },
  CONFIRMED: { label: 'Đã gửi công ty', fg: ui.blue, soft: ui.blueSoft },
  RESERVED: { label: 'Đã giữ hàng', fg: ui.violet, soft: ui.violetSoft },
  PICKING: { label: 'Đang soạn', fg: ui.warning, soft: ui.warningSoft },
  SHIPPED: { label: 'Đã tạo đơn giao', fg: ui.blue, soft: ui.blueSoft },
  PARTIALLY_SHIPPED: { label: 'Giao một phần', fg: ui.warning, soft: ui.warningSoft },
  DELIVERED: { label: 'Đã giao', fg: ui.success, soft: ui.successSoft },
  COMPLETED: { label: 'Hoàn tất', fg: ui.success, soft: ui.successSoft },
  CANCELLED: { label: 'Đã hủy', fg: ui.danger, soft: ui.dangerSoft },
};

const statusFilters: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'NPP_REVIEWING', label: 'Đã tiếp nhận' },
  { key: 'CONFIRMED', label: 'Đã gửi công ty' },
  { key: 'SHIPPED', label: 'Đã tạo đơn giao' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function StatusChip({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, fg: ui.text, soft: ui.surfaceMuted };
  return <span style={{ background: meta.soft, color: meta.fg, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 }}>{meta.label}</span>;
}

export default function NppOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [deliveryActualKg, setDeliveryActualKg] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pageSize = 10;

  const selectOrder = useCallback((order: ApiOrder | null) => {
    if (!order) {
      setSelected(null);
      return;
    }
    setSelected(order);
    setDeliveryActualKg(order.totalKg ? order.totalKg.toFixed(1) : '');
    apiGet<ApiOrder>(`/npp/orders/${order.id}`).then((detail) => {
      setSelected(detail);
      setDeliveryActualKg(detail.totalKg ? detail.totalKg.toFixed(1) : '');
    }).catch(() => undefined);
  }, []);

  const load = useCallback((targetPage: number, targetStatus: string) => {
    const query = `?page=${targetPage}&pageSize=${pageSize}${targetStatus !== 'ALL' ? `&status=${targetStatus}` : ''}`;
    apiGet<PaginatedOrders<ApiOrder>>(`/npp/orders${query}`)
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
        setPage(res.page);
        selectOrder(res.items[0] ?? null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được đơn hàng.'));
  }, [selectOrder]);

  useEffect(() => { load(1, status); }, [load, status]);

  async function receive(order: ApiOrder) {
    setMessage('');
    setError('');
    try {
      await apiSend(`/npp/orders/${order.id}/receive`, 'POST');
      setMessage(`Đã tiếp nhận đơn ${order.code}.`);
      load(page, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tiếp nhận được đơn.');
    }
  }

  async function createDelivery(order: ApiOrder) {
    setMessage('');
    setError('');
    const actualKg = Number(deliveryActualKg);
    if (!Number.isFinite(actualKg) || actualKg <= 0) {
      setError('Nhap kg thuc can cua don giao truoc khi tao phieu.');
      return;
    }
    try {
      await apiSend(`/npp/orders/${order.id}/delivery`, 'POST', { actualTotalKg: actualKg });
      setMessage(`Đã tạo đơn giao ${order.code}. Tồn kho NPP đã được trừ theo đơn.`);
      load(page, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được đơn giao.');
    }
  }

  async function completeDelivery(order: ApiOrder) {
    setMessage('');
    setError('');
    try {
      await apiSend(`/npp/orders/${order.id}/complete`, 'POST');
      setMessage(`Đã hoàn thành đơn ${order.code}.`);
      load(page, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không hoàn thành được đơn.');
    }
  }

  async function openDeliveryPdf(order: ApiOrder, mode: 'open' | 'print') {
    setError('');
    try {
      const blob = await apiBlob(`/npp/orders/${order.id}/delivery-pdf`);
      const url = URL.createObjectURL(blob);
      if (mode === 'print') {
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        frame.src = url;
        document.body.appendChild(frame);
        frame.onload = () => {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
          setTimeout(() => { document.body.removeChild(frame); URL.revokeObjectURL(url); }, 1500);
        };
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất được PDF.');
    }
  }

  async function downloadDeliveryExcel(order: ApiOrder) {
    setError('');
    try {
      const blob = await apiBlob(`/npp/orders/${order.id}/delivery-excel`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu-giao-hang-${order.code}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất được Excel.');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const factoryContact = selected?.createdBy?.organization;

  return (
    <NppPage>
      <p style={eyebrowStyle}>Đơn hàng</p>
      <h1 style={pageTitleStyle}>Đơn hàng từ xưởng</h1>
      <p style={subtitleStyle}>Tiếp nhận đơn từ cơ sở sản xuất, kiểm tra chi tiết hàng và tạo phiếu giao khi đã sẵn sàng.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
        {statusFilters.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)} style={{ ...ghostButtonStyle, background: status === f.key ? ui.brandSoft : ui.surface, color: status === f.key ? ui.brandText : ui.text, borderColor: status === f.key ? ui.brand : ui.borderStrong }}>
            {f.label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={{ ...panelStyle, marginTop: 16, textAlign: 'center', padding: 48, color: ui.textFaint }}>Chưa có đơn hàng nào ở trạng thái này.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: 20, marginTop: 4, alignItems: 'start' }}>
          <div style={{ ...panelStyle, padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{['Mã đơn', 'Xưởng', 'Giá trị', 'Trạng thái'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} onClick={() => selectOrder(order)} style={{ cursor: 'pointer', background: selected?.id === order.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{order.code}</td>
                      <td style={tableCellStyle}>{order.factoryName || 'Chưa xác định'}</td>
                      <td style={tableCellStyle}>{currency(order.totalAmount)}</td>
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
                  <MapPin size={13} /> {selected.factoryName || factoryContact?.name || 'Chưa xác định'}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '16px 0' }}>
                  <div style={{ background: ui.surfaceMuted, border: `1px solid ${ui.border}`, borderRadius: 10, padding: 12 }}>
                    <small style={{ color: ui.textFaint }}>Tổng kg</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{selected.totalKg.toFixed(1)} kg</p>
                  </div>
                  <div style={{ background: ui.surfaceMuted, border: `1px solid ${ui.border}`, borderRadius: 10, padding: 12 }}>
                    <small style={{ color: ui.textFaint }}>Giá trị</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{currency(selected.totalAmount)}</p>
                  </div>
                </div>

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><UserRound size={15} /> Thông tin nhận hàng</h3>
                <div style={{ color: ui.textMuted, fontSize: 13, lineHeight: 1.7 }}>
                  <div>Khách hàng: <strong style={{ color: ui.text }}>{selected.customerName || 'Không ghi'}</strong></div>
                  <div>Điện thoại: <strong style={{ color: ui.text }}>{selected.customerPhone || 'Không ghi'}</strong></div>
                  <div>Địa chỉ: <strong style={{ color: ui.text }}>{selected.deliveryAddress || 'Không ghi'}</strong></div>
                  {selected.note ? <div>Ghi chú: <strong style={{ color: ui.text }}>{selected.note}</strong></div> : null}
                </div>

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}><PackageOpen size={15} /> Chi tiết hàng</h3>
                {selected.items.map((item, idx) => (
                  <div key={`${item.productCode}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: '9px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 13 }}>
                    <span style={{ color: ui.text }}><strong>{item.productCode}</strong> - {item.productName} {item.colorCode ? `(${item.colorCode})` : ''} x{item.quantity}</span>
                    <span style={{ color: ui.textFaint }}>{item.totalKg.toFixed(1)} kg</span>
                  </div>
                ))}

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, marginTop: 18, display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={15} /> Lịch sử xử lý</h3>
                {selected.histories.map((event) => {
                  const meta = statusMeta[event.status] ?? { label: event.title, fg: ui.brand };
                  return (
                    <div key={`${event.status}-${event.createdAt}`} style={{ padding: '7px 0', fontSize: 13 }}>
                      <strong style={{ color: meta.fg }}>{event.title}</strong>
                      <p style={{ margin: '2px 0 0', color: ui.textFaint }}>{event.note || meta.label} · {event.actor}</p>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                  {selected.status === 'NEW' ? (
                    <button onClick={() => receive(selected)} style={ghostButtonStyle}><CheckCircle2 size={14} /> Tiếp nhận</button>
                  ) : null}
                  {selected.status === 'NPP_REVIEWING' ? (
                    <>
                      <label style={{ ...labelStyle, display: 'inline-grid', minWidth: 180 }}>Kg thuc can don giao
                        <input style={{ ...inputStyle, height: 38 }} type="number" step="0.1" value={deliveryActualKg} onChange={(e) => setDeliveryActualKg(e.target.value)} placeholder={selected.totalKg.toFixed(1)} />
                      </label>
                      <button onClick={() => createDelivery(selected)} style={{ ...ghostButtonStyle, background: ui.brandSoft, color: ui.brandText }}><Truck size={14} /> Tạo đơn giao</button>
                    </>
                  ) : null}
                  {selected.status === 'SHIPPED' || selected.status === 'DELIVERED' || selected.status === 'COMPLETED' ? (
                    <>
                      <button onClick={() => openDeliveryPdf(selected, 'open')} style={ghostButtonStyle}><FileText size={14} /> PDF</button>
                      <button onClick={() => openDeliveryPdf(selected, 'print')} style={ghostButtonStyle}><Printer size={14} /> In đơn</button>
                      <button onClick={() => downloadDeliveryExcel(selected)} style={ghostButtonStyle}><FileSpreadsheet size={14} /> Excel</button>
                      {selected.status !== 'COMPLETED' ? (
                        <button onClick={() => completeDelivery(selected)} style={{ ...ghostButtonStyle, background: ui.successSoft, color: ui.success }}><CheckCircle2 size={14} /> Hoàn thành đơn</button>
                      ) : null}
                    </>
                  ) : null}
                  {selected.status !== 'NEW' && selected.status !== 'NPP_REVIEWING' ? (
                    <p style={{ color: ui.textFaint, fontSize: 13, margin: 0 }}>Đơn đang ở trạng thái <StatusChip status={selected.status} />.</p>
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
