'use client';

import { useEffect, useState } from 'react';
import { HandCoins } from 'lucide-react';
import type { DebtItem } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import {
  chipStyle,
  currency,
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

const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  OPEN: { label: 'Chưa thu', tone: 'warning' },
  PARTIAL: { label: 'Một phần', tone: 'warning' },
  PAID: { label: 'Đã xong', tone: 'success' },
};

export default function NppDebtsPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<DebtItem[]>('/npp/debts').then(setDebts).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được công nợ.'));
  }

  useEffect(() => { load(); }, []);

  const totalOpen = debts.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  async function pay() {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError('Nhập số tiền hợp lệ.');
      return;
    }
    try {
      await apiSend(`/npp/debts/${selected.id}/payments`, 'POST', { amount });
      setMessage('Đã ghi nhận thanh toán.');
      setPayAmount('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi nhận được thanh toán.');
    }
  }

  return (
    <NppPage>
      <p style={eyebrowStyle}>CÔNG NỢ</p>
      <h1 style={pageTitleStyle}>Công nợ Xưởng phải trả NPP</h1>
      <p style={subtitleStyle}>Tự động sinh khi đơn hàng hoàn tất — ghi nhận thanh toán khi Xưởng trả tiền.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ ...panelStyle, padding: 18, margin: '12px 0 20px', maxWidth: 320 }}>
        <HandCoins size={18} color={ui.danger} />
        <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>Tổng còn phải thu</small>
        <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalOpen)}</strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Xưởng', 'Đơn hàng', 'Số tiền', 'Còn lại', 'Trạng thái'].map((head) => (
                    <th key={head} style={tableHeadStyle}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {debts.map((d) => {
                  const meta = statusMeta[d.status] ?? statusMeta.OPEN;
                  return (
                    <tr key={d.id} onClick={() => setSelected(d)} style={{ cursor: 'pointer', background: selected?.id === d.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{d.factoryOrgName ?? d.partnerName}</td>
                      <td style={tableCellStyle}>{d.orderCode ?? '—'}</td>
                      <td style={tableCellStyle}>{currency(d.amount)}</td>
                      <td style={tableCellStyle}>{currency(d.amount - d.paidAmount)}</td>
                      <td style={tableCellStyle}><span style={chipStyle(meta.tone === 'success' ? 'success' : meta.tone === 'danger' ? 'danger' : 'warning')}>{meta.label}</span></td>
                    </tr>
                  );
                })}
                {debts.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có công nợ nào.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          {selected ? (
            <>
              <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected.factoryOrgName ?? selected.partnerName}</h2>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>Đơn hàng: {selected.orderCode ?? '—'}</p>
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
            <p style={{ color: ui.textFaint }}>Chọn một khoản công nợ để ghi nhận thanh toán.</p>
          )}
        </div>
      </div>
    </NppPage>
  );
}
