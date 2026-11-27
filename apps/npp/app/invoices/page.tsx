'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, FileDown, FilePlus2, Replace, Save, Send, Trash2 } from 'lucide-react';
import type {
  InvoiceProviderCode,
  PaginatedOrders,
  SalesInvoiceStatus,
  TaxBusinessLine,
  TaxPitMethod,
  UpdateWorkshopTaxProfileInput,
  WorkshopSalesInvoice,
  WorkshopSalesInvoiceSummary,
  WorkshopTaxLedger,
  WorkshopTaxProfile,
} from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiBlob, apiGet, apiGetQuery, apiSend } from '../../src/lib/api';
import { shortCode } from '../../src/lib/short-code';
import {
  chipStyle, currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, panelTitleStyle,
  primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui, type Tone,
} from '../../src/ui';

const DISCLAIMER = 'Số liệu do app tổng hợp để tham khảo. Cơ sở kinh doanh chịu trách nhiệm số khai thuế; nên nhờ kế toán xác nhận tỷ lệ % theo ngành.';

const STATUS: Record<SalesInvoiceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Nháp', tone: 'warning' },
  ISSUED: { label: 'Đã phát hành', tone: 'success' },
  CANCELLED: { label: 'Đã huỷ', tone: 'danger' },
  REPLACED: { label: 'Đã thay thế', tone: 'brandBlack' },
};

const STATUS_FILTERS: Array<{ key: '' | SalesInvoiceStatus; label: string }> = [
  { key: '', label: 'Tất cả' }, { key: 'DRAFT', label: 'Nháp' }, { key: 'ISSUED', label: 'Đã phát hành' }, { key: 'CANCELLED', label: 'Đã huỷ' }, { key: 'REPLACED', label: 'Đã thay thế' },
];

const ALERT_TEXT: Record<string, { text: string; tone: Tone }> = {
  NONE: { text: 'Chưa chạm ngưỡng miễn thuế.', tone: 'success' },
  NEAR: { text: 'Đã đạt từ 80% ngưỡng miễn thuế. Chuẩn bị đăng ký hoá đơn điện tử.', tone: 'warning' },
  CROSSED: { text: 'Doanh thu đã vượt ngưỡng. Cần đăng ký hoá đơn điện tử trước hạn.', tone: 'danger' },
  OVERDUE: { text: 'Đã quá hạn đăng ký hoá đơn điện tử.', tone: 'danger' },
  REGISTERED: { text: 'Đã đăng ký hoá đơn điện tử.', tone: 'success' },
};

const BUSINESS_LINES: Array<{ key: TaxBusinessLine; title: string }> = [
  { key: 'TRADING', title: 'Phân phối, bán buôn nhôm kính, phụ kiện' },
  { key: 'MANUFACTURING', title: 'Sản xuất, gia công nhôm kính' },
  { key: 'CONSTRUCTION_WITH_MATERIALS', title: 'Xây lắp có bao thầu vật tư' },
];

type OrderOption = { id: string; code: string; factoryName: string; customerName: string; status: string; totalAmount: number };
type EditLine = { name: string; unit: string; quantity: string; unitPrice: string };
type Tab = 'invoices' | 'ledger' | 'profile';

const TABS: Array<{ key: Tab; label: string }> = [{ key: 'invoices', label: 'Hoá đơn' }, { key: 'ledger', label: 'Sổ doanh thu' }, { key: 'profile', label: 'Hồ sơ thuế' }];

function today() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

function toEditLines(invoice: WorkshopSalesInvoice): EditLine[] {
  return invoice.lines.map((l) => ({ name: l.name, unit: l.unit, quantity: String(l.quantity), unitPrice: String(l.unitPrice) }));
}

function lineTotal(line: EditLine) {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0));
}

function Notice({ message, error }: { message: string; error: string }) {
  return (
    <>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}
    </>
  );
}

export default function NppInvoicesPage() {
  const [tab, setTab] = useState<Tab>('invoices');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Hàm ổn định: các tab đặt chúng trong mảng phụ thuộc của useEffect, đổi mỗi lần vẽ lại sẽ tải lại dữ liệu và xoá chữ đang gõ.
  const say = useCallback((ok: string) => { setMessage(ok); setError(''); }, []);
  const fail = useCallback((e: unknown, fallback: string) => { setError(e instanceof Error ? e.message : fallback); setMessage(''); }, []);

  return (
    <NppPage>
      <p style={eyebrowStyle}>Hoá đơn &amp; thuế</p>
      <h1 style={pageTitleStyle}>Hoá đơn bán ra của nhà phân phối</h1>
      <p style={subtitleStyle}>Lập hoá đơn từ đơn hàng đã giao xưởng, theo dõi doanh thu cả năm so với ngưỡng 1 tỷ và xuất sổ cho kế toán.</p>
      <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { setTab(t.key); setMessage(''); setError(''); }} style={tab === t.key ? primaryButtonStyle : ghostButtonStyle}>{t.label}</button>
        ))}
      </div>
      <Notice message={message} error={error} />
      {tab === 'invoices' ? <InvoicesTab say={say} fail={fail} /> : null}
      {tab === 'ledger' ? <LedgerTab fail={fail} /> : null}
      {tab === 'profile' ? <ProfileTab say={say} fail={fail} /> : null}
    </NppPage>
  );
}

// ---------------------------------------------------------------- Hoá đơn

type TabProps = { say: (ok: string) => void; fail: (e: unknown, fallback: string) => void };

function InvoicesTab({ say, fail }: TabProps) {
  const [list, setList] = useState<WorkshopSalesInvoiceSummary[]>([]);
  const [status, setStatus] = useState<'' | SalesInvoiceStatus>('');
  const [q, setQ] = useState('');
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [orderId, setOrderId] = useState('');
  const [selected, setSelected] = useState<WorkshopSalesInvoice | null>(null);
  const [buyer, setBuyer] = useState({ buyerName: '', buyerTaxCode: '', buyerAddress: '', buyerEmail: '', buyerPhone: '', issueDate: today(), note: '' });
  const [lines, setLines] = useState<EditLine[]>([]);
  const [ext, setExt] = useState({ series: '', number: '', issueDate: today() });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGetQuery<WorkshopSalesInvoiceSummary[]>('/npp/tax/invoices', { status, q: q.trim() || undefined }).then(setList).catch((e) => fail(e, 'Không tải được danh sách hoá đơn.'));
  }, [status, q, fail]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiGet<PaginatedOrders<OrderOption>>('/npp/orders?page=1&pageSize=100').then((res) => setOrders(res.items ?? [])).catch(() => setOrders([])); }, []);

  function open(invoice: WorkshopSalesInvoice) {
    setSelected(invoice);
    setBuyer({
      buyerName: invoice.buyerName, buyerTaxCode: invoice.buyerTaxCode, buyerAddress: invoice.buyerAddress, buyerEmail: invoice.buyerEmail,
      buyerPhone: invoice.buyerPhone, issueDate: invoice.issueDate, note: invoice.note,
    });
    setLines(toEditLines(invoice));
    setExt({ series: invoice.series, number: '', issueDate: invoice.issueDate });
    setReason('');
  }

  async function run<T>(work: () => Promise<T>, ok: string, fallback: string): Promise<T | null> {
    setBusy(true);
    try {
      const result = await work();
      say(ok);
      load();
      return result;
    } catch (e) {
      fail(e, fallback);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    try { open(await apiGet<WorkshopSalesInvoice>(`/npp/tax/invoices/${id}`)); } catch (e) { fail(e, 'Không mở được hoá đơn.'); }
  }

  async function createBlank() {
    const created = await run(() => apiSend<WorkshopSalesInvoice>('/npp/tax/invoices', 'POST', { buyerName: '', lines: [{ name: '', unit: 'kg', quantity: 1, unitPrice: 0 }] }), 'Đã lập hoá đơn nháp.', 'Không lập được hoá đơn.');
    if (created) open(created);
  }

  async function createFromOrder() {
    if (!orderId) return;
    const created = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/from-order/${orderId}`, 'POST'), 'Đã lập nháp từ đơn hàng. Kiểm tra người mua và mã số thuế trước khi phát hành.', 'Không lập được từ đơn hàng.');
    if (created) { open(created); setOrderId(''); }
  }

  function payload() {
    return {
      ...buyer,
      lines: lines.map((l) => ({ name: l.name, unit: l.unit, quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 })),
    };
  }

  async function save() {
    if (!selected) return null;
    const saved = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/${selected.id}`, 'PATCH', payload()), 'Đã lưu hoá đơn nháp.', 'Không lưu được hoá đơn.');
    if (saved) open(saved);
    return saved;
  }

  async function issue() {
    if (!selected) return;
    const saved = await save();
    if (!saved) return;
    const issued = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/${selected.id}/issue`, 'POST'), 'Đã phát hành hoá đơn.', 'Không phát hành được hoá đơn.');
    if (issued) open(issued);
  }

  async function recordExternal() {
    if (!selected) return;
    const saved = await save();
    if (!saved) return;
    const done = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/${selected.id}/record-external`, 'POST', ext), 'Đã ghi số hoá đơn xuất ở hệ thống khác.', 'Không ghi được số hoá đơn.');
    if (done) open(done);
  }

  async function remove() {
    if (!selected || !window.confirm('Xoá hoá đơn nháp này?')) return;
    const done = await run(() => apiSend<{ ok: true }>(`/npp/tax/invoices/${selected.id}`, 'DELETE'), 'Đã xoá hoá đơn nháp.', 'Không xoá được hoá đơn.');
    if (done) setSelected(null);
  }

  async function cancel() {
    if (!selected) return;
    const done = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/${selected.id}/cancel`, 'POST', { reason }), 'Đã huỷ hoá đơn.', 'Không huỷ được hoá đơn.');
    if (done) open(done);
  }

  async function replace() {
    if (!selected) return;
    const done = await run(() => apiSend<WorkshopSalesInvoice>(`/npp/tax/invoices/${selected.id}/replace`, 'POST'), 'Đã lập nháp thay thế. Sửa rồi phát hành để thay hoá đơn cũ.', 'Không lập được hoá đơn thay thế.');
    if (done) open(done);
  }

  async function pdf() {
    if (!selected) return;
    try {
      const blob = await apiBlob(`/npp/tax/invoices/${selected.id}/pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) {
      fail(e, 'Không xuất được PDF.');
    }
  }

  const isDraft = selected?.status === 'DRAFT';
  const draftTotal = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);
  const setLine = (i: number, key: keyof EditLine, value: string) => setLines((rows) => rows.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  return (
    <div className="npp-split" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 18, alignItems: 'start' }}>
      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Danh sách hoá đơn</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" onClick={createBlank} disabled={busy} style={primaryButtonStyle}><FilePlus2 size={15} /> Lập hoá đơn trống</button>
          <select value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ ...inputStyle, width: 'auto', minWidth: 220 }} aria-label="Chọn đơn hàng để lập hoá đơn">
            <option value="">Chọn đơn hàng giao xưởng…</option>
            {orders.map((o) => <option key={o.id} value={o.id}>{shortCode(o.code)} · {o.factoryName || o.customerName} · {currency(o.totalAmount)}</option>)}
          </select>
          <button type="button" onClick={createFromOrder} disabled={!orderId || busy} style={ghostButtonStyle}>Lập từ đơn hàng</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {STATUS_FILTERS.map((f) => <button key={f.key} type="button" onClick={() => setStatus(f.key)} style={status === f.key ? { ...ghostButtonStyle, background: ui.brandSoft, color: ui.brandText, borderColor: ui.brand } : ghostButtonStyle}>{f.label}</button>)}
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo người mua, số hoá đơn, mã số thuế, mã đơn" style={{ ...inputStyle, marginBottom: 12 }} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Số', 'Ngày', 'Người mua', 'Tổng tiền', 'Trạng thái'].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((row) => (
                <tr key={row.id} onClick={() => openDetail(row.id)} style={{ cursor: 'pointer', background: selected?.id === row.id ? ui.brandSoft : undefined }}>
                  <td style={tableCellStyle} title={row.projectCode ? `Từ đơn ${row.projectCode}` : undefined}>{row.number ? `${row.series} · ${row.number}` : 'Chưa có số'}</td>
                  <td style={tableCellStyle}>{row.issueDate}</td>
                  <td style={tableCellStyle}>{row.buyerName || '-'}</td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(row.total)}</td>
                  <td style={tableCellStyle}><span style={chipStyle(STATUS[row.status].tone)}>{STATUS[row.status].label}</span></td>
                </tr>
              ))}
              {!list.length ? <tr><td colSpan={5} style={{ ...tableCellStyle, color: ui.textMuted }}>Chưa có hoá đơn nào.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        {!selected ? <p style={{ color: ui.textMuted, margin: 0 }}>Chọn một hoá đơn bên trái, hoặc lập hoá đơn mới từ đơn hàng.</p> : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <h2 style={{ ...panelTitleStyle, margin: 0 }}>{selected.number ? `Hoá đơn ${selected.series} · ${selected.number}` : 'Hoá đơn nháp'}</h2>
              <span style={chipStyle(STATUS[selected.status].tone)}>{STATUS[selected.status].label}</span>
            </div>
            {selected.projectCode ? <p style={{ color: ui.textMuted, fontSize: 13, margin: '6px 0 0' }}>Từ đơn hàng <strong title={selected.projectCode}>{shortCode(selected.projectCode)}</strong></p> : null}
            {selected.lookupCode ? <p style={{ color: ui.textMuted, fontSize: 13, margin: '4px 0 0' }}>Mã tra cứu: {selected.lookupCode}{selected.provider === 'SANDBOX' ? ' (Bản thử, không có giá trị pháp lý)' : ''}</p> : null}
            {selected.cancelReason ? <p style={{ color: ui.danger, fontSize: 13, margin: '4px 0 0' }}>Lý do huỷ: {selected.cancelReason}</p> : null}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 14 }}>
              <label style={labelStyle}>Người mua<input disabled={!isDraft} value={buyer.buyerName} onChange={(e) => setBuyer({ ...buyer, buyerName: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Mã số thuế người mua<input disabled={!isDraft} value={buyer.buyerTaxCode} onChange={(e) => setBuyer({ ...buyer, buyerTaxCode: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Địa chỉ<input disabled={!isDraft} value={buyer.buyerAddress} onChange={(e) => setBuyer({ ...buyer, buyerAddress: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Điện thoại<input disabled={!isDraft} value={buyer.buyerPhone} onChange={(e) => setBuyer({ ...buyer, buyerPhone: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Email<input disabled={!isDraft} value={buyer.buyerEmail} onChange={(e) => setBuyer({ ...buyer, buyerEmail: e.target.value })} style={inputStyle} /></label>
              <label style={labelStyle}>Ngày hoá đơn<input disabled={!isDraft} type="date" value={buyer.issueDate} onChange={(e) => setBuyer({ ...buyer, issueDate: e.target.value })} style={inputStyle} /></label>
            </div>
            <label style={{ ...labelStyle, marginTop: 12 }}>Ghi chú<input disabled={!isDraft} value={buyer.note} onChange={(e) => setBuyer({ ...buyer, note: e.target.value })} style={inputStyle} /></label>

            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Hàng hoá', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', ''].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i}>
                      <td style={{ ...tableCellStyle, whiteSpace: 'normal', minWidth: 200 }}><input disabled={!isDraft} value={line.name} onChange={(e) => setLine(i, 'name', e.target.value)} style={inputStyle} aria-label={`Tên hàng dòng ${i + 1}`} /></td>
                      <td style={{ ...tableCellStyle, width: 70 }}><input disabled={!isDraft} value={line.unit} onChange={(e) => setLine(i, 'unit', e.target.value)} style={inputStyle} aria-label={`Đơn vị dòng ${i + 1}`} /></td>
                      <td style={{ ...tableCellStyle, width: 100 }}><input disabled={!isDraft} inputMode="decimal" value={line.quantity} onChange={(e) => setLine(i, 'quantity', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} aria-label={`Số lượng dòng ${i + 1}`} /></td>
                      <td style={{ ...tableCellStyle, width: 130 }}><input disabled={!isDraft} inputMode="numeric" value={line.unitPrice} onChange={(e) => setLine(i, 'unitPrice', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} aria-label={`Đơn giá dòng ${i + 1}`} /></td>
                      <td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(lineTotal(line))}</td>
                      <td style={tableCellStyle}>{isDraft ? <button type="button" onClick={() => setLines((rows) => rows.filter((_, j) => j !== i))} style={{ ...ghostButtonStyle, padding: '6px 8px' }} aria-label={`Xoá dòng ${i + 1}`}><Trash2 size={14} /></button> : null}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4} style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 700 }}>Tổng cộng</td><td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800 }}>{currency(isDraft ? draftTotal : selected.total)}</td><td style={tableCellStyle} /></tr>
                </tfoot>
              </table>
            </div>
            {isDraft ? <button type="button" onClick={() => setLines((rows) => [...rows, { name: '', unit: 'kg', quantity: '1', unitPrice: '0' }])} style={{ ...ghostButtonStyle, marginTop: 10 }}>+ Thêm dòng</button> : null}

            {isDraft ? (
              <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={save} disabled={busy} style={ghostButtonStyle}><Save size={15} /> Lưu nháp</button>
                  <button type="button" onClick={issue} disabled={busy} style={primaryButtonStyle}><Send size={15} /> Phát hành qua nhà cung cấp</button>
                  <button type="button" onClick={remove} disabled={busy} style={{ ...ghostButtonStyle, color: ui.danger }}><Trash2 size={15} /> Xoá nháp</button>
                  <button type="button" onClick={pdf} style={ghostButtonStyle}><FileDown size={15} /> Xem PDF</button>
                </div>
                <div style={{ border: `1px dashed ${ui.borderStrong}`, borderRadius: 12, padding: 12 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 13 }}>Hoặc ghi số hoá đơn đã xuất ở phần mềm khác</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                    <label style={labelStyle}>Ký hiệu<input value={ext.series} onChange={(e) => setExt({ ...ext, series: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Số hoá đơn<input value={ext.number} onChange={(e) => setExt({ ...ext, number: e.target.value })} style={inputStyle} /></label>
                    <label style={labelStyle}>Ngày xuất<input type="date" value={ext.issueDate} onChange={(e) => setExt({ ...ext, issueDate: e.target.value })} style={inputStyle} /></label>
                  </div>
                  <button type="button" onClick={recordExternal} disabled={busy} style={{ ...ghostButtonStyle, marginTop: 10 }}>Ghi số đã xuất</button>
                </div>
              </div>
            ) : null}

            {selected.status === 'ISSUED' ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" onClick={pdf} style={ghostButtonStyle}><FileDown size={15} /> Xem PDF</button>
                  <button type="button" onClick={replace} disabled={busy} style={ghostButtonStyle}><Replace size={15} /> Lập hoá đơn thay thế</button>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Lý do huỷ hoá đơn" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
                  <button type="button" onClick={cancel} disabled={busy} style={{ ...ghostButtonStyle, color: ui.danger }}><Ban size={15} /> Huỷ hoá đơn</button>
                </div>
              </div>
            ) : null}
            {!isDraft && selected.status !== 'ISSUED' ? <div style={{ marginTop: 16 }}><button type="button" onClick={pdf} style={ghostButtonStyle}><FileDown size={15} /> Xem PDF</button></div> : null}

            {selected.events.length ? (
              <div style={{ marginTop: 18 }}>
                <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13, color: ui.textMuted }}>NHẬT KÝ</p>
                {selected.events.map((e, i) => <p key={i} style={{ margin: '2px 0', fontSize: 13, color: ui.textMuted }}>{new Date(e.createdAt).toLocaleString('vi-VN')} · {e.actorName || 'Hệ thống'} · {e.detail}</p>)}
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Sổ doanh thu

function LedgerTab({ fail }: { fail: TabProps['fail'] }) {
  const [year, setYear] = useState(Number(today().slice(0, 4)));
  const [ledger, setLedger] = useState<WorkshopTaxLedger | null>(null);

  useEffect(() => {
    apiGetQuery<WorkshopTaxLedger>('/npp/tax/ledger', { year: String(year) }).then(setLedger).catch((e) => fail(e, 'Không tải được sổ doanh thu.'));
  }, [year, fail]);

  async function download(path: string, name: string) {
    try {
      const blob = await apiBlob(`${path}?year=${year}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      fail(e, 'Không tải được báo cáo.');
    }
  }

  if (!ledger) return <p style={{ color: ui.textMuted }}>Đang tải sổ doanh thu…</p>;
  const alert = ALERT_TEXT[ledger.alert] ?? ALERT_TEXT.NONE;
  const pct = Math.min(100, Math.round(ledger.thresholdPct));

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={panelStyle}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" onClick={() => setYear(year - 1)} style={ghostButtonStyle}>‹</button>
            <strong style={{ fontSize: 18 }}>Năm {year}</strong>
            <button type="button" onClick={() => setYear(year + 1)} style={ghostButtonStyle}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => download('/npp/tax/reports/s1a.xlsx', `so-doanh-thu-S1a-${year}.xlsx`)} style={ghostButtonStyle}><FileDown size={15} /> Sổ S1a-HKD (Excel)</button>
            <button type="button" onClick={() => download('/npp/tax/reports/invoices.xlsx', `bang-ke-hoa-don-${year}.xlsx`)} style={ghostButtonStyle}><FileDown size={15} /> Bảng kê hoá đơn (Excel)</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 16 }}>
          <div><p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>Doanh thu theo hoá đơn đã phát hành</p><p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>{currency(ledger.totalInvoiced)}</p></div>
          <div><p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>Tiền đã thu (đối chiếu)</p><p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>{currency(ledger.totalCollected)}</p></div>
          <div><p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>Còn lại tới ngưỡng {currency(ledger.threshold)}</p><p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 800 }}>{currency(Math.max(0, ledger.remaining))}</p></div>
        </div>
        <div style={{ height: 10, background: ui.surfaceMuted, borderRadius: 999, marginTop: 16, overflow: 'hidden' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Mức so với ngưỡng miễn thuế">
          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? ui.danger : pct >= 80 ? ui.warning : ui.teal }} />
        </div>
        <p style={{ margin: '10px 0 0' }}><span style={chipStyle(alert.tone)}>{alert.text}</span></p>
        {ledger.registrationDeadline ? <p style={{ margin: '8px 0 0', fontSize: 13 }}>Hạn đăng ký hoá đơn điện tử: <strong>{ledger.registrationDeadline}</strong>{ledger.daysToDeadline !== null ? ` (còn ${ledger.daysToDeadline} ngày)` : ''}</p> : null}
        <p style={{ margin: '6px 0 0', fontSize: 13, color: ui.textMuted }}>Hạn thông báo doanh thu năm: {ledger.annualNoticeDeadline}. Còn {ledger.draftCount} hoá đơn nháp chưa phát hành.</p>
      </section>

      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Theo tháng</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tháng', 'Hoá đơn', 'Số hoá đơn', 'Tiền thu'].map((h) => <th key={h} style={tableHeadStyle}>{h}</th>)}</tr></thead>
            <tbody>{ledger.months.map((m) => (
              <tr key={m.month}><td style={tableCellStyle}>Tháng {m.month}</td><td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(m.invoiced)}</td><td style={{ ...tableCellStyle, textAlign: 'right' }}>{m.invoiceCount}</td><td style={{ ...tableCellStyle, textAlign: 'right' }}>{currency(m.collected)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={panelTitleStyle}>Thuế tạm tính</h2>
        <p style={{ margin: '0 0 6px' }}>{ledger.tax.exempt ? 'Doanh thu chưa vượt ngưỡng nên chưa phát sinh GTGT, TNCN.' : `GTGT ${currency(ledger.tax.vat)}${ledger.tax.pit !== null ? ` · TNCN ${currency(ledger.tax.pit)}` : ''} · Tổng ${currency(ledger.tax.total)}`}</p>
        <p style={{ margin: 0, fontSize: 13, color: ui.textMuted }}>{ledger.tax.vatFormula}{ledger.tax.pitFormula ? ` · ${ledger.tax.pitFormula}` : ''}</p>
        {!ledger.rule.confirmed ? <p style={{ margin: '8px 0 0', fontSize: 13, color: ui.warning, fontWeight: 600 }}>Tỷ lệ % theo ngành năm {ledger.rule.year} chưa được kế toán xác nhận.</p> : null}
        <p style={{ margin: '8px 0 0', fontSize: 12, color: ui.textMuted }}>{DISCLAIMER}</p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Hồ sơ thuế

function ProfileTab({ say, fail }: TabProps) {
  const [profile, setProfile] = useState<WorkshopTaxProfile | null>(null);
  const [form, setForm] = useState<UpdateWorkshopTaxProfileInput>({});
  const [vat, setVat] = useState('');
  const [pit, setPit] = useState('');

  useEffect(() => {
    apiGet<WorkshopTaxProfile>('/npp/tax/profile').then((p) => {
      setProfile(p);
      setForm({ entityType: p.entityType, taxCode: p.taxCode, legalName: p.legalName, legalAddress: p.legalAddress, locationCode: p.locationCode, businessLine: p.businessLine, pitMethod: p.pitMethod, invoiceSeries: p.invoiceSeries, provider: p.provider, einvoiceRegisteredAt: p.einvoiceRegisteredAt?.slice(0, 10) ?? null });
      setVat(p.vatRatePct === null ? '' : String(p.vatRatePct));
      setPit(p.pitRatePct === null ? '' : String(p.pitRatePct));
    }).catch((e) => fail(e, 'Không tải được hồ sơ thuế.'));
  }, [fail]);

  async function save() {
    try {
      const saved = await apiSend<WorkshopTaxProfile>('/npp/tax/profile', 'PUT', { ...form, vatRatePct: vat.trim() === '' ? null : Number(vat), pitRatePct: pit.trim() === '' ? null : Number(pit) });
      setProfile(saved);
      say(saved.isComplete ? 'Đã lưu hồ sơ thuế. Đủ thông tin để phát hành hoá đơn.' : 'Đã lưu hồ sơ thuế. Còn thiếu mã số thuế, tên hoặc ký hiệu hoá đơn.');
    } catch (e) {
      fail(e, 'Không lưu được hồ sơ thuế.');
    }
  }

  if (!profile) return <p style={{ color: ui.textMuted }}>Đang tải hồ sơ thuế…</p>;
  const set = (patch: UpdateWorkshopTaxProfileInput) => setForm((f) => ({ ...f, ...patch }));

  return (
    <section style={panelStyle}>
      <h2 style={panelTitleStyle}>Hồ sơ thuế của nhà phân phối</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
        <label style={labelStyle}>Loại hình
          <select value={form.entityType} onChange={(e) => set({ entityType: e.target.value as 'HKD' | 'DN' })} style={inputStyle}><option value="HKD">Hộ kinh doanh</option><option value="DN">Doanh nghiệp</option></select>
        </label>
        <label style={labelStyle}>Ngành
          <select value={form.businessLine} onChange={(e) => set({ businessLine: e.target.value as TaxBusinessLine })} style={inputStyle}>{BUSINESS_LINES.map((b) => <option key={b.key} value={b.key}>{b.title}</option>)}</select>
        </label>
        <label style={labelStyle}>Mã số thuế<input value={form.taxCode ?? ''} onChange={(e) => set({ taxCode: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Tên đăng ký kinh doanh<input value={form.legalName ?? ''} onChange={(e) => set({ legalName: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Địa chỉ đăng ký<input value={form.legalAddress ?? ''} onChange={(e) => set({ legalAddress: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Mã địa điểm kinh doanh<input value={form.locationCode ?? ''} onChange={(e) => set({ locationCode: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Ký hiệu hoá đơn (ví dụ 1C26TAP)<input value={form.invoiceSeries ?? ''} onChange={(e) => set({ invoiceSeries: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Nhà cung cấp hoá đơn
          <select value={form.provider} onChange={(e) => set({ provider: e.target.value as InvoiceProviderCode })} style={inputStyle}><option value="NONE">Chưa dùng (chỉ ghi số đã xuất)</option><option value="SANDBOX">Bản thử (không có giá trị pháp lý)</option></select>
        </label>
        <label style={labelStyle}>Cách tính thuế TNCN
          <select value={form.pitMethod} onChange={(e) => set({ pitMethod: e.target.value as TaxPitMethod })} style={inputStyle}><option value="REVENUE_RATE">Theo tỷ lệ trên doanh thu</option><option value="INCOME">Theo thu nhập (doanh thu trừ chi phí)</option></select>
        </label>
        <label style={labelStyle}>GTGT % (để trống = {profile.defaults.vatPct}%)<input inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>TNCN % (để trống = {profile.defaults.pitPct}%)<input inputMode="decimal" value={pit} onChange={(e) => setPit(e.target.value)} style={inputStyle} /></label>
        <label style={labelStyle}>Ngày đã đăng ký hoá đơn điện tử<input type="date" value={form.einvoiceRegisteredAt ?? ''} onChange={(e) => set({ einvoiceRegisteredAt: e.target.value || null })} style={inputStyle} /></label>
      </div>
      {!profile.defaults.confirmed ? <p style={{ margin: '12px 0 0', fontSize: 13, color: ui.warning, fontWeight: 600 }}>Tỷ lệ mặc định năm {profile.defaults.year} chưa được kế toán xác nhận. Nhờ kế toán kiểm tra rồi nhập tỷ lệ chính xác vào hai ô trên.</p> : null}
      <p style={{ margin: '8px 0 14px', fontSize: 12, color: ui.textMuted }}>{DISCLAIMER}</p>
      <button type="button" onClick={save} style={primaryButtonStyle}><Save size={15} /> Lưu hồ sơ thuế</button>
    </section>
  );
}
