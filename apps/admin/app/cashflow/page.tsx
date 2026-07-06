'use client';

import { useEffect, useMemo, useState } from 'react';
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { CashTransactionItem, CreateCashTransactionInput } from '@eurohouse/types';
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

export default function CashflowPage() {
  const [transactions, setTransactions] = useState<CashTransactionItem[]>([]);
  const [filterType, setFilterType] = useState<'ALL' | 'RECEIPT' | 'PAYMENT'>('ALL');
  const [form, setForm] = useState({ type: 'PAYMENT' as 'RECEIPT' | 'PAYMENT', amount: '', category: '', partnerName: '', method: 'CASH' as 'CASH' | 'BANK_TRANSFER', note: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiGet<CashTransactionItem[]>('/cash-transactions').then(setTransactions).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được phiếu thu chi.'));
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => transactions.filter((t) => filterType === 'ALL' || t.type === filterType), [transactions, filterType]);
  const totalReceipt = transactions.filter((t) => t.type === 'RECEIPT').reduce((s, t) => s + t.amount, 0);
  const totalPayment = transactions.filter((t) => t.type === 'PAYMENT').reduce((s, t) => s + t.amount, 0);

  async function submit() {
    setError('');
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError('Nhập số tiền hợp lệ.');
      return;
    }
    setSubmitting(true);
    try {
      const input: CreateCashTransactionInput = {
        type: form.type, amount, category: form.category || undefined,
        partnerName: form.partnerName || undefined, method: form.method, note: form.note || undefined,
      };
      await apiSend('/cash-transactions', 'POST', input);
      setMessage(`Đã tạo phiếu ${form.type === 'RECEIPT' ? 'thu' : 'chi'}.`);
      setForm({ type: 'PAYMENT', amount: '', category: '', partnerName: '', method: 'CASH', note: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được phiếu.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminPage>
      <p style={eyebrowStyle}>THU CHI</p>
      <h1 style={pageTitleStyle}>Phiếu thu & phiếu chi</h1>
      <p style={subtitleStyle}>Ghi nhận dòng tiền vào/ra thực tế — điện, gas, nước, mua vật tư, thu khách hàng...</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, margin: '12px 0 20px' }}>
        <div style={{ ...panelStyle, padding: 18 }}>
          <TrendingUp size={18} color={ui.success} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng thu</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalReceipt)}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <TrendingDown size={18} color={ui.danger} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng chi</small>
          <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalPayment)}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 18 }}>
          <Wallet size={18} color={ui.blue} />
          <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Chênh lệch</small>
          <strong style={{ display: 'block', fontSize: 22, color: totalReceipt - totalPayment >= 0 ? ui.success : ui.danger }}>{currency(totalReceipt - totalPayment)}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['ALL', 'RECEIPT', 'PAYMENT'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{ ...ghostButtonStyle, background: filterType === t ? ui.brandSoft : ui.surface, color: filterType === t ? ui.brandText : ui.text, borderColor: filterType === t ? ui.brand : ui.borderStrong }}
          >
            {t === 'ALL' ? 'Tất cả' : t === 'RECEIPT' ? 'Phiếu thu' : 'Phiếu chi'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Mã phiếu', 'Loại', 'Số tiền', 'Danh mục', 'Đối tác', 'Ngày'].map((head) => (
                    <th key={head} style={tableHeadStyle}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t.id}>
                    <td style={{ ...tableCellStyle, fontWeight: 700 }}>{t.code}</td>
                    <td style={tableCellStyle}><span style={chipStyle(t.type === 'RECEIPT' ? 'success' : 'danger')}>{t.type === 'RECEIPT' ? 'Thu' : 'Chi'}</span></td>
                    <td style={tableCellStyle}>{currency(t.amount)}</td>
                    <td style={tableCellStyle}>{t.category || '—'}</td>
                    <td style={tableCellStyle}>{t.partnerName || '—'}</td>
                    <td style={tableCellStyle}>{new Date(t.transDate).toLocaleDateString('vi-VN')}</td>
                  </tr>
                ))}
                {visible.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có phiếu nào.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          <h2 style={{ margin: '0 0 12px', color: ui.text, fontSize: 16, fontWeight: 800 }}>Tạo phiếu mới</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setForm((f) => ({ ...f, type: 'RECEIPT' }))} style={{ ...ghostButtonStyle, flex: 1, justifyContent: 'center', background: form.type === 'RECEIPT' ? ui.successSoft : ui.surface, color: form.type === 'RECEIPT' ? ui.success : ui.text }}>Thu</button>
            <button onClick={() => setForm((f) => ({ ...f, type: 'PAYMENT' }))} style={{ ...ghostButtonStyle, flex: 1, justifyContent: 'center', background: form.type === 'PAYMENT' ? ui.dangerSoft : ui.surface, color: form.type === 'PAYMENT' ? ui.danger : ui.text }}>Chi</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <label style={labelStyle}>
              Số tiền
              <input style={inputStyle} type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
            </label>
            <label style={labelStyle}>
              Danh mục
              <input style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Điện SX, thu khách hàng..." />
            </label>
            <label style={labelStyle}>
              Đối tác
              <input style={inputStyle} value={form.partnerName} onChange={(e) => setForm((f) => ({ ...f, partnerName: e.target.value }))} />
            </label>
            <label style={labelStyle}>
              Phương thức
              <select style={inputStyle} value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as 'CASH' | 'BANK_TRANSFER' }))}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER">Chuyển khoản</option>
              </select>
            </label>
            <label style={labelStyle}>
              Ghi chú
              <input style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </label>
          </div>
          <button onClick={submit} disabled={submitting} style={{ ...primaryButtonStyle, width: '100%', marginTop: 14 }}>
            {submitting ? 'Đang lưu...' : 'Tạo phiếu'}
          </button>
        </div>
      </div>
    </AdminPage>
  );
}
