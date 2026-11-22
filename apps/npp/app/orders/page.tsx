'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, FileSpreadsheet, FileText, MapPin, PackageOpen, Plus, Printer, Truck, UserRound } from 'lucide-react';
import { fixLegacyUtf8Mojibake } from '@eurohouse/types';
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
  theoreticalTotalKg: number;
  actualTotalKg?: number | null;
  totalAmount: number;
  pricingStatus: 'PENDING_NPP' | 'FINALIZED' | 'ESTIMATED_COMPANY';
  finalUnitPricePerKg?: number | null;
  pricingDiscountAmount?: number;
  pricingSurchargeAmount?: number;
  pricingNote?: string;
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

function fixVietnamese(value?: string) {
  return value ? fixLegacyUtf8Mojibake(value) : '';
}

function StatusChip({ status }: { status: string }) {
  const meta = statusMeta[status] ?? { label: status, fg: ui.text, soft: ui.surfaceMuted };
  return <span style={{ background: meta.soft, color: meta.fg, borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 }}>{fixVietnamese(meta.label)}</span>;
}

function estimatedKg(order: ApiOrder) {
  return order.theoreticalTotalKg || order.items.reduce((sum, item) => sum + (item.totalKg || 0), 0) || order.totalKg;
}

export default function NppOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('ALL');
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [deliveryActualKg, setDeliveryActualKg] = useState('');
  const [deliveryUnitPrice, setDeliveryUnitPrice] = useState('');
  const [deliveryDiscount, setDeliveryDiscount] = useState('0');
  const [deliverySurcharge, setDeliverySurcharge] = useState('0');
  const [deliveryPricingNote, setDeliveryPricingNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pageSize = 10;

  const selectOrder = useCallback((order: ApiOrder | null) => {
    if (!order) {
      setSelected(null);
      return;
    }
    setSelected(order);
    setDeliveryActualKg((order.actualTotalKg ?? order.theoreticalTotalKg ?? order.totalKg)?.toFixed(2) || '');
    setDeliveryUnitPrice(order.finalUnitPricePerKg ? String(order.finalUnitPricePerKg) : '');
    setDeliveryDiscount(String(order.pricingDiscountAmount ?? 0));
    setDeliverySurcharge(String(order.pricingSurchargeAmount ?? 0));
    setDeliveryPricingNote(order.pricingNote ?? '');
    apiGet<ApiOrder>(`/npp/orders/${order.id}`).then((detail) => {
      setSelected(detail);
      setDeliveryActualKg((detail.actualTotalKg ?? detail.theoreticalTotalKg ?? detail.totalKg)?.toFixed(2) || '');
      setDeliveryUnitPrice(detail.finalUnitPricePerKg ? String(detail.finalUnitPricePerKg) : '');
      setDeliveryDiscount(String(detail.pricingDiscountAmount ?? 0));
      setDeliverySurcharge(String(detail.pricingSurchargeAmount ?? 0));
      setDeliveryPricingNote(detail.pricingNote ?? '');
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
    const unitPrice = Number(deliveryUnitPrice);
    const discountAmount = Number(deliveryDiscount || 0);
    const surchargeAmount = Number(deliverySurcharge || 0);
    if (!Number.isFinite(actualKg) || actualKg <= 0) {
      setError('Nhập kg thực cân của đơn giao trước khi tạo phiếu.');
      return;
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      setError('Nhập đơn giá NPP áp dụng cho đơn giao.');
      return;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || !Number.isFinite(surchargeAmount) || surchargeAmount < 0) {
      setError('Giảm giá hoặc phụ phí không hợp lệ.');
      return;
    }
    const finalAmount = Math.round(actualKg * unitPrice) - Math.round(discountAmount) + Math.round(surchargeAmount);
    if (finalAmount <= 0) return setError('Thành tiền chính thức phải lớn hơn 0.');
    if (!window.confirm(`Xác nhận chốt đơn ${order.code}\n${actualKg.toLocaleString('vi-VN')} kg × ${unitPrice.toLocaleString('vi-VN')} đ/kg\nThành tiền: ${currency(finalAmount)}\n\nSau khi xác nhận, giá trị này sẽ được gửi tới CSSX.`)) return;
    try {
      await apiSend(`/npp/orders/${order.id}/delivery`, 'POST', {
        actualTotalKg: actualKg,
        finalUnitPricePerKg: unitPrice,
        discountAmount,
        surchargeAmount,
        pricingNote: deliveryPricingNote.trim() || undefined,
      });
      setMessage(`Đã chốt giá và tạo đơn giao ${order.code}. CSSX đã nhận được giá trị chính thức.`);
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
  const pricingPreview = Math.max(0,
    Math.round(Number(deliveryActualKg || 0) * Number(deliveryUnitPrice || 0))
      - Math.round(Number(deliveryDiscount || 0))
      + Math.round(Number(deliverySurcharge || 0)),
  );

  return (
    <NppPage>
      <p style={eyebrowStyle}>Đơn hàng</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <h1 style={pageTitleStyle}>Đơn hàng từ xưởng</h1>
        <Link href="/orders/new" style={{ ...ghostButtonStyle, background: ui.brand, color: '#fff', textDecoration: 'none' }}><Plus size={15} /> Tạo đơn cho CSSX</Link>
      </div>
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
                  <tr>{['Mã đơn', 'Xưởng', 'Giá trị chốt', 'Trạng thái'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} onClick={() => selectOrder(order)} style={{ cursor: 'pointer', background: selected?.id === order.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{order.code}</td>
                      <td style={tableCellStyle}>{order.factoryName || 'Chưa xác định'}</td>
                      <td style={tableCellStyle}>{order.pricingStatus === 'FINALIZED' ? currency(order.totalAmount) : <span style={{ color: ui.textFaint }}>Chờ cân và chốt giá</span>}</td>
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
                    <small style={{ color: ui.textFaint }}>Kg dự tính</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{estimatedKg(selected).toFixed(2)} kg</p>
                    {selected.actualTotalKg ? <small style={{ color: ui.success }}>Thực cân: {selected.actualTotalKg.toFixed(2)} kg</small> : null}
                  </div>
                  <div style={{ background: ui.surfaceMuted, border: `1px solid ${ui.border}`, borderRadius: 10, padding: 12 }}>
                    <small style={{ color: ui.textFaint }}>Giá trị chính thức</small>
                    <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 16 }}>{selected.pricingStatus === 'FINALIZED' ? currency(selected.totalAmount) : 'Chờ NPP chốt'}</p>
                    {selected.finalUnitPricePerKg ? <small style={{ color: ui.textFaint }}>{currency(selected.finalUnitPricePerKg)}/kg</small> : null}
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
                  const title = fixVietnamese(event.title || meta.label);
                  const note = fixVietnamese(event.note || meta.label);
                  const actor = fixVietnamese(event.actor);
                  return (
                    <div key={`${event.status}-${event.createdAt}`} style={{ padding: '7px 0', fontSize: 13 }}>
                      <strong style={{ color: meta.fg }}>{title}</strong>
                      <p style={{ margin: '2px 0 0', color: ui.textFaint }}>{note} · {actor}</p>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                  {selected.status === 'NEW' ? (
                    <button onClick={() => receive(selected)} style={ghostButtonStyle}><CheckCircle2 size={14} /> Tiếp nhận</button>
                  ) : null}
                  {['NPP_REVIEWING', 'CONFIRMED', 'RESERVED'].includes(selected.status) ? (
                    <div style={{ width: '100%', display: 'grid', gap: 12, padding: 14, border: `1px solid ${ui.border}`, borderRadius: 12, background: ui.surfaceMuted }}>
                      <strong style={{ color: ui.text }}>Cân hàng và chốt giá giao CSSX</strong>
                      <p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>Kg dự tính: {estimatedKg(selected).toFixed(2)} kg. Giá chỉ được gửi tới CSSX sau bước xác nhận này.</p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(160px, 1fr))', gap: 10 }}>
                        <label style={labelStyle}>Kg thực cân toàn đơn
                          <input style={{ ...inputStyle, height: 38 }} type="number" min="0" step="0.01" value={deliveryActualKg} onChange={(e) => setDeliveryActualKg(e.target.value)} placeholder={estimatedKg(selected).toFixed(2)} />
                        </label>
                        <label style={labelStyle}>Đơn giá NPP (đ/kg)
                          <input style={{ ...inputStyle, height: 38 }} type="number" min="0" step="100" value={deliveryUnitPrice} onChange={(e) => setDeliveryUnitPrice(e.target.value)} placeholder="Nhập đơn giá giao thực tế" />
                        </label>
                        <label style={labelStyle}>Giảm giá (đ)
                          <input style={{ ...inputStyle, height: 38 }} type="number" min="0" step="1000" value={deliveryDiscount} onChange={(e) => setDeliveryDiscount(e.target.value)} />
                        </label>
                        <label style={labelStyle}>Phụ phí (đ)
                          <input style={{ ...inputStyle, height: 38 }} type="number" min="0" step="1000" value={deliverySurcharge} onChange={(e) => setDeliverySurcharge(e.target.value)} />
                        </label>
                      </div>
                      <label style={labelStyle}>Ghi chú giá
                        <input style={{ ...inputStyle, height: 38 }} value={deliveryPricingNote} onChange={(e) => setDeliveryPricingNote(e.target.value)} placeholder="Chiết khấu, vận chuyển hoặc thỏa thuận riêng" />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div><small style={{ color: ui.textFaint }}>Thành tiền sẽ ghi nhận</small><div style={{ color: ui.brandText, fontSize: 20, fontWeight: 900 }}>{currency(pricingPreview)}</div></div>
                        <button onClick={() => createDelivery(selected)} style={{ ...ghostButtonStyle, background: ui.brand, color: '#fff' }}><Truck size={14} /> Xác nhận giá và tạo đơn giao</button>
                      </div>
                    </div>
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
