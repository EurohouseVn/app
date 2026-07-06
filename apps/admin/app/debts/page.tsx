'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, HandCoins } from 'lucide-react';
import type { DebtItem } from '@eurohouse/types';
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

const typeLabel: Record<string, string> = { NPP: 'NPP', ACCESSORY: 'Phụ kiện', CUSTOMER: 'Khách hàng' };
const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  OPEN: { label: 'Chưa thu/trả', tone: 'warning' },
  PARTIAL: { label: 'Một phần', tone: 'warning' },
  PAID: { label: 'Đã xong', tone: 'success' },
};

export default function DebtsPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [direction, setDirection] = useState<'ALL' | 'PAYABLE' | 'RECEIVABLE'>('ALL');
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [form, setForm] = useState({ type: 'CUSTOMER', direction: 'RECEIVABLE', partnerName: '', amount: '', note: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<DebtItem[]>('/debts').then(setDebts).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được công nợ.'));
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => debts.filter((d) => direction === 'ALL' || (d.direction ?? 'PAYABLE') === direction), [debts, direction]);
  const totalReceivable = debts.filter((d) => (d.direction ?? 'PAYABLE') === 'RECEIVABLE').reduce((s, d) => s + (d.amount - d.paidAmount), 0);
  const totalPayable = debts.filter((d) => (d.direction ?? 'PAYABLE') === 'PAYABLE').reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  async function createDebt() {
    setError('');
    if (!form.partnerName || !form.amount) {
      setError('Nhập đối tác và số tiền.');
      return;
    }
    try {
      await apiSend('/debts', 'POST', { ...form, amount: Number(form.amount) });
      setMessage('Đã tạo khoản công nợ mới.');
      setForm({ type: 'CUSTOMER', direction: 'RECEIVABLE', partnerName: '', amount: '', note: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được công nợ.');
    }
  }

  async function pay() {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError('Nhập số tiền hợp lệ.');
      return;
    }
    try {
      await apiSend(`/debts/${selected.id}/payments`, 'POST', { amount });
      setMessage('Đã ghi nhận thanh toán.');
      setPayAmount('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi nhận được thanh toán.');
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>CÔNG NỢ</p>
      <h1 style={pageTitleStyle}>Công nợ phải thu & phải trả</h1>
      <p style={subtitleStyle}>Theo dõi khoản phải thu từ khách hàng và khoản phải trả cho NPP/nhà cung cấp.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16, margin: '12px 0 20px' }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <ArrowDownCircle size={18} color={ui.success} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng phải thu (còn lại)</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalReceivable)}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <ArrowUpCircle size={18} color={ui.danger} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng phải trả (còn lại)</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalPayable)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['ALL', 'RECEIVABLE', 'PAYABLE'] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            style={{ ...ghostButtonStyle, background: direction === d ? ui.brandSoft : ui.surface, color: direction === d ? ui.brandText : ui.text, borderColor: direction === d ? ui.brand : ui.borderStrong }}
          >
            {d === 'ALL' ? 'Tất cả' : d === 'RECEIVABLE' ? 'Phải thu' : 'Phải trả'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Đối tác', 'Loại', 'Số tiền', 'Còn lại', 'Trạng thái'].map((head) => (
                    <th key={head} style={tableHeadStyle}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const meta = statusMeta[d.status] ?? statusMeta.OPEN;
                  return (
                    <tr key={d.id} onClick={() => setSelected(d)} style={{ cursor: 'pointer', background: selected?.id === d.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{d.partnerName}</td>
                      <td style={tableCellStyle}>{typeLabel[d.type] ?? d.type}</td>
                      <td style={tableCellStyle}>{currency(d.amount)}</td>
                      <td style={tableCellStyle}>{currency(d.amount - d.paidAmount)}</td>
                      <td style={tableCellStyle}><span style={chipStyle(meta.tone === 'success' ? 'success' : meta.tone === 'danger' ? 'danger' : 'warning')}>{meta.label}</span></td>
                    </tr>
                  );
                })}
                {visible.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có công nợ nào.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          {selected ? (
            <>
              <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected.partnerName}</h2>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>{typeLabel[selected.type] ?? selected.type} · {selected.bankName ? `${selected.bankName} ${selected.bankAccount}` : 'Chưa có thông tin ngân hàng'}</p>
              <div style={{ display: 'flex', gap: 24, margin: '14px 0' }}>
                <div>
                  <small style={{ color: ui.textFaint }}>Tổng nợ</small>
                  <p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 18 }}>{currency(selected.amount)}</p>
                </div>
                <div>
                  <small style={{ color: ui.textFaint }}>Còn lại</small>
                  <p style={{ margin: 0, fontWeight: 800, color: ui.danger, fontSize: 18 }}>{currency(selected.amount - selected.paidAmount)}</p>
                </div>
              </div>
              <label style={labelStyle}>
                Ghi nhận thanh toán
                <input style={inputStyle} type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Số tiền" />
              </label>
              <button onClick={pay} style={{ ...primaryButtonStyle, width: '100%', marginTop: 10 }}>
                <HandCoins size={14} /> Ghi nhận thanh toán
              </button>
              {selected.note ? <p style={{ color: ui.textFaint, fontSize: 13, marginTop: 14 }}>{selected.note}</p> : null}
            </>
          ) : (
            <>
              <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 16, fontWeight: 800 }}>Tạo công nợ mới</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                <label style={labelStyle}>
                  Chiều
                  <select style={inputStyle} value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))}>
                    <option value="RECEIVABLE">Phải thu</option>
                    <option value="PAYABLE">Phải trả</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  Loại
                  <select style={inputStyle} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    <option value="CUSTOMER">Khách hàng</option>
                    <option value="NPP">NPP</option>
                    <option value="ACCESSORY">Phụ kiện / NCC</option>
                  </select>
                </label>
                <label style={labelStyle}>
                  Đối tác
                  <input style={inputStyle} value={form.partnerName} onChange={(e) => setForm((f) => ({ ...f, partnerName: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Số tiền
                  <input style={inputStyle} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </label>
                <label style={labelStyle}>
                  Ghi chú
                  <input style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                </label>
              </div>
              <button onClick={createDebt} style={{ ...primaryButtonStyle, width: '100%', marginTop: 14 }}>Tạo công nợ</button>
            </>
          )}
        </div>
      </div>
    </AdminPage>
  );
}
