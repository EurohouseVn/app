'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, FileText, MapPin, PackageX, PlayCircle, Printer, Truck, X } from 'lucide-react';
import { AdminShell } from '../../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../../src/auth';
import { apiGet, apiSend, openAuthedFile, printAuthedFile } from '../../src/lib/api';
import {
  eyebrowStyle,
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

type ColorCode = { id: string; code: string; name: string; hex?: string };

type ApiOrderItem = {
  productCode: string;
  productName: string;
  quantity: number;
  unit: string;
  totalKg: number;
  colorCode: string;
  unitPrice: number;
  totalPrice: number;
  profile?: { code?: string; kgPerMeter?: number; barsPerBundle?: number } | null;
};

type ApiOrder = {
  id: string;
  code: string;
  sourceType: string;
  factoryName: string;
  dealerName: string;
  nppName: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  colorCode: string;
  note: string;
  accessoriesNote: string;
  customerCode: string;
  invoiceNo: string;
  poNo: string;
  status: string;
  totalKg: number;
  totalAmount: number;
  createdAt: string;
  items: ApiOrderItem[];
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
  const [preview, setPreview] = useState<ApiOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [colors, setColors] = useState<ColorCode[]>([]);
  const [exportFields, setExportFields] = useState({ customerCode: '', invoiceNo: '', poNo: '' });
  const [savingExport, setSavingExport] = useState(false);

  const colorNameByCode = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of colors) map[c.code] = c.name;
    return map;
  }, [colors]);

  const load = useCallback(() => {
    apiGet<ApiOrder[]>('/admin/orders')
      .then((data) => {
        setOrders(data);
        setSelected((current) => {
          const next = current ? data.find((order) => order.id === current.id) ?? data[0] ?? null : data[0] ?? null;
          if (next) {
            setExportFields({
              customerCode: next.customerCode ?? '',
              invoiceNo: next.invoiceNo ?? '',
              poNo: next.poNo ?? '',
            });
          }
          return next;
        });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Không tải được đơn hàng'));
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    apiGet<ColorCode[]>('/catalog/colors')
      .then(setColors)
      .catch(() => setColors([]));
  }, [user, load]);

  function selectOrder(order: ApiOrder) {
    setSelected(order);
    setExportFields({
      customerCode: order.customerCode ?? '',
      invoiceNo: order.invoiceNo ?? '',
      poNo: order.poNo ?? '',
    });
  }

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

  async function saveExportFields() {
    if (!selected) return;
    setSavingExport(true);
    setMessage('');
    try {
      await apiSend(`/orders/${selected.id}/export-fields`, 'PATCH', exportFields);
      setMessage(`Đã lưu thông tin xuất kho cho đơn ${selected.code}.`);
      load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không lưu được thông tin xuất kho');
    } finally {
      setSavingExport(false);
    }
  }

  async function handlePdf(order: ApiOrder, mode: 'open' | 'print') {
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'print') await printAuthedFile(`/orders/${order.id}/pdf`);
      else await openAuthedFile(`/orders/${order.id}/pdf`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Không xuất được PDF');
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={eyebrowStyle}>ĐƠN HÀNG</p>
      <h1 style={pageTitleStyle}>Luồng đơn: Xưởng → NPP → Công ty</h1>
      <p style={subtitleStyle}>Theo dõi toàn bộ đơn hàng, nhập thông tin xuất kho và in phiếu xuất kho.</p>
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
                      onClick={() => selectOrder(order)}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 19, fontWeight: 800 }}>{selected.code}</h2>
                  <button
                    onClick={() => setPreview(selected)}
                    style={{
                      border: `1px solid ${ui.brand}`,
                      background: ui.brandSoft,
                      color: ui.brandText,
                      borderRadius: 10,
                      padding: '7px 12px',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <FileText size={14} /> Xem phiếu xuất kho
                  </button>
                </div>
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

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700, margin: '0 0 10px' }}>Thông tin xuất kho</h3>
                <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
                  <label style={labelStyle}>
                    Mã khách hàng
                    <input
                      style={inputStyle}
                      value={exportFields.customerCode}
                      onChange={(e) => setExportFields((s) => ({ ...s, customerCode: e.target.value }))}
                      placeholder="VD: VCBEURPPTHANGGIANG"
                    />
                  </label>
                  <label style={labelStyle}>
                    Số hóa đơn
                    <input
                      style={inputStyle}
                      value={exportFields.invoiceNo}
                      onChange={(e) => setExportFields((s) => ({ ...s, invoiceNo: e.target.value }))}
                      placeholder="VD: 00000"
                    />
                  </label>
                  <label style={labelStyle}>
                    Số đơn đặt hàng
                    <input
                      style={inputStyle}
                      value={exportFields.poNo}
                      onChange={(e) => setExportFields((s) => ({ ...s, poNo: e.target.value }))}
                      placeholder="Số PO / số đơn đặt"
                    />
                  </label>
                  <button onClick={saveExportFields} disabled={savingExport} style={{ ...primaryButtonStyle, opacity: savingExport ? 0.7 : 1 }}>
                    {savingExport ? 'Đang lưu…' : 'Lưu thông tin xuất'}
                  </button>
                </div>

                <h3 style={{ color: ui.text, fontSize: 14, fontWeight: 700 }}>Chi tiết hàng</h3>
                {selected.items.map((item, idx) => (
                  <div key={`${item.productCode}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${ui.border}`, fontSize: 13 }}>
                    <span style={{ color: ui.text }}>
                      {item.productName} ×{item.quantity}
                      {item.colorCode ? ` · ${colorNameByCode[item.colorCode] ?? item.colorCode}` : ''}
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

      {preview ? (
        <OrderFormModal
          order={preview}
          colorNameByCode={colorNameByCode}
          busy={busy}
          onClose={() => setPreview(null)}
          onPrint={() => handlePdf(preview, 'print')}
          onPdf={() => handlePdf(preview, 'open')}
        />
      ) : null}
    </AdminShell>
  );
}

function OrderFormModal({
  order,
  colorNameByCode,
  busy,
  onClose,
  onPrint,
  onPdf,
}: {
  order: ApiOrder;
  colorNameByCode: Record<string, string>;
  busy: boolean;
  onClose: () => void;
  onPrint: () => void;
  onPdf: () => void;
}) {
  const colors = useMemo(() => {
    const seen: string[] = [];
    for (const it of order.items) {
      const c = it.colorCode || '';
      if (!seen.includes(c)) seen.push(c);
    }
    return seen;
  }, [order.items]);

  const colorSummary = useMemo(() => {
    return colors.map((code) => {
      const kg = order.items.filter((it) => (it.colorCode || '') === code).reduce((s, it) => s + (it.totalKg || 0), 0);
      return { code, name: colorNameByCode[code] || code || '(Không màu)', kg };
    });
  }, [colors, order.items, colorNameByCode]);

  const pivotRows = useMemo(() => {
    const map = new Map<
      string,
      {
        profileCode: string;
        productName: string;
        kgPerMeter: number;
        barsPerBundle: number;
        byColor: Record<string, number>;
        total: number;
      }
    >();
    for (const it of order.items) {
      const key = it.profile?.code || it.productCode || it.productName;
      let row = map.get(key);
      if (!row) {
        row = {
          profileCode: it.profile?.code || it.productCode || '',
          productName: it.productName,
          kgPerMeter: it.profile?.kgPerMeter ?? 0,
          barsPerBundle: it.profile?.barsPerBundle ?? 0,
          byColor: {},
          total: 0,
        };
        colors.forEach((c) => {
          row!.byColor[c] = 0;
        });
        map.set(key, row);
      }
      const c = it.colorCode || '';
      row.byColor[c] = (row.byColor[c] || 0) + (it.quantity || 0);
      row.total += it.quantity || 0;
    }
    return Array.from(map.values());
  }, [order.items, colors]);

  const colorTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    colors.forEach((c) => (totals[c] = 0));
    for (const r of pivotRows) {
      colors.forEach((c) => {
        totals[c] += r.byColor[c] || 0;
      });
    }
    return totals;
  }, [pivotRows, colors]);

  const grandTotal = pivotRows.reduce((s, r) => s + r.total, 0);
  const totalKg = colorSummary.reduce((s, r) => s + r.kg, 0);

  const th: React.CSSProperties = {
    border: '1px solid #999',
    padding: '6px 8px',
    background: '#EDEDED',
    fontSize: 11,
    fontWeight: 700,
    textAlign: 'center',
    whiteSpace: 'nowrap',
  };
  const td: React.CSSProperties = {
    border: '1px solid #999',
    padding: '5px 8px',
    fontSize: 11.5,
  };
  const infoLabel: React.CSSProperties = { color: '#666', fontSize: 12, width: 120, display: 'inline-block' };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,20,0.55)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, position: 'sticky', top: 0, zIndex: 2 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrint();
          }}
          disabled={busy}
          style={{ border: 'none', background: ui.brand, color: '#fff', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <Printer size={16} /> In
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPdf();
          }}
          disabled={busy}
          style={{ border: `1px solid ${ui.borderStrong}`, background: '#fff', color: ui.text, borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <FileText size={16} /> Xuất PDF
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{ border: `1px solid ${ui.borderStrong}`, background: '#fff', color: ui.text, borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}
        >
          <X size={16} /> Đóng
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 1100, maxWidth: '100%', background: '#fff', borderRadius: 8, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', color: '#111' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, color: '#B71C1C', fontSize: 14 }}>CÔNG TY EUROHOUSE</div>
            <div style={{ color: '#666', fontSize: 11 }}>Hệ thống nhôm kính Eurohouse</div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#333' }}>
            <div>
              <strong>Số phiếu:</strong> {order.code}
            </div>
            <div>
              <strong>Ngày:</strong> {new Date(order.createdAt).toLocaleDateString('vi-VN')}
            </div>
          </div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, margin: '14px 0 12px' }}>PHIẾU XUẤT KHO</h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 16, fontSize: 12.5, lineHeight: 1.8 }}>
          <div>
            <div>
              <span style={infoLabel}>Mã khách hàng</span>
              {order.customerCode || '—'}
            </div>
            <div>
              <span style={infoLabel}>Tên khách hàng</span>
              {order.customerName || '—'}
            </div>
            <div>
              <span style={infoLabel}>Địa chỉ</span>
              {order.deliveryAddress || '—'}
            </div>
            <div>
              <span style={infoLabel}>Điện thoại</span>
              {order.customerPhone || '—'}
            </div>
          </div>
          <div>
            <div>
              <span style={infoLabel}>Số phiếu</span>
              {order.code}
            </div>
            <div>
              <span style={infoLabel}>Số hóa đơn</span>
              {order.invoiceNo || '—'}
            </div>
            <div>
              <span style={infoLabel}>Số đơn đặt hàng</span>
              {order.poNo || '—'}
            </div>
          </div>
        </div>

        <h3 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 8px' }}>Bảng tổng hợp theo màu</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18 }}>
          <thead>
            <tr>
              {['STT', 'Mã VT', 'Tên mô tả', 'ĐVT', 'Thực tế (Kg)'].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {colorSummary.map((r, i) => (
              <tr key={r.code || i}>
                <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
                <td style={td}>{r.code || '—'}</td>
                <td style={td}>{r.name}</td>
                <td style={{ ...td, textAlign: 'center' }}>Kg</td>
                <td style={{ ...td, textAlign: 'right' }}>{r.kg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td>
              </tr>
            ))}
            <tr>
              <td style={td} colSpan={4}>
                <strong>TỔNG CỘNG</strong>
              </td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{totalKg.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</td>
            </tr>
          </tbody>
        </table>

        <h3 style={{ fontSize: 13, fontWeight: 800, margin: '0 0 8px' }}>Bảng chi tiết theo cây nhôm</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 18, minWidth: 700 }}>
            <thead>
              <tr>
                <th style={th}>STT</th>
                <th style={th}>Mã VT</th>
                <th style={th}>Tên mô tả</th>
                <th style={th}>
                  Tỷ trọng
                  <br />
                  (kg/m)
                </th>
                <th style={th}>
                  Quy cách
                  <br />
                  (cây/bó)
                </th>
                {colors.map((c) => (
                  <th key={c || 'none'} style={th}>
                    {colorNameByCode[c] || c || '(Không màu)'}
                  </th>
                ))}
                <th style={th}>
                  Tổng
                  <br />
                  (cây)
                </th>
              </tr>
            </thead>
            <tbody>
              {pivotRows.map((r, i) => (
                <tr key={r.profileCode || i}>
                  <td style={{ ...td, textAlign: 'center' }}>{i + 1}</td>
                  <td style={td}>{r.profileCode || '—'}</td>
                  <td style={td}>{r.productName}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{r.kgPerMeter ? r.kgPerMeter.toLocaleString('vi-VN', { maximumFractionDigits: 3 }) : '—'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>{r.barsPerBundle || '—'}</td>
                  {colors.map((c) => (
                    <td key={c || 'none'} style={{ ...td, textAlign: 'center' }}>
                      {r.byColor[c] || ''}
                    </td>
                  ))}
                  <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{r.total}</td>
                </tr>
              ))}
              <tr>
                <td style={td} colSpan={5}>
                  <strong>TỔNG CỘNG</strong>
                </td>
                {colors.map((c) => (
                  <td key={c || 'none'} style={{ ...td, textAlign: 'center', fontWeight: 700 }}>
                    {colorTotals[c] || 0}
                  </td>
                ))}
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{grandTotal}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 36, textAlign: 'center' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12 }}>NGƯỜI LẬP PHIẾU</div>
            <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12 }}>NGƯỜI NHẬN HÀNG</div>
            <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 12 }}>THỦ KHO</div>
            <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>(Ký, ghi rõ họ tên)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
