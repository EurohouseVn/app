'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, HandCoins } from 'lucide-react';
import type { DebtItem, DebtPaymentRequestItem } from '@eurohouse/types';
import { NppPage } from '../../src/NppPage';
import { apiGet, apiSend } from '../../src/lib/api';
import { chipStyle, currency, eyebrowStyle, ghostButtonStyle, inputStyle, labelStyle, pageTitleStyle, panelStyle, primaryButtonStyle, subtitleStyle, tableCellStyle, tableHeadStyle, ui } from '../../src/ui';

const statusMeta: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  OPEN: { label: 'Chưa thu', tone: 'warning' },
  PARTIAL: { label: 'Một phần', tone: 'warning' },
  PAID: { label: 'Đã xong', tone: 'success' },
};

const methodLabel: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
};

export default function NppDebtsPage() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [requests, setRequests] = useState<DebtPaymentRequestItem[]>([]);
  const [scope, setScope] = useState<'FACTORY' | 'COMPANY'>('FACTORY');
  const [selected, setSelected] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function load() {
    apiGet<DebtItem[]>('/npp/debts').then(setDebts).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được công nợ.'));
    apiGet<DebtPaymentRequestItem[]>('/npp/debts/payment-requests').then(setRequests).catch(() => setRequests([]));
  }

  useEffect(() => { load(); }, []);

  const factoryDebts = debts.filter((d) => d.factoryOrgId);
  const companyDebts = debts.filter((d) => !d.factoryOrgId);
  const visible = scope === 'FACTORY' ? factoryDebts : companyDebts;
  const totalOpen = visible.reduce((s, d) => s + (d.amount - d.paidAmount), 0);

  async function pay() {
    if (!selected) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setError('Nhập số tiền hợp lệ.');
      return;
    }
    try {
      await apiSend(`/npp/debts/${selected.id}/payments`, 'POST', { amount, method: 'CASH' });
      setMessage('Đã ghi nhận thanh toán.');
      setPayAmount('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không ghi nhận được thanh toán.');
    }
  }

  async function confirmRequest(request: DebtPaymentRequestItem) {
    setError('');
    setMessage('');
    try {
      await apiSend(`/npp/debts/payment-requests/${request.id}/confirm`, 'POST');
      setMessage(`Đã xác nhận thanh toán ${request.code}. Công nợ đã được giảm trừ.`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xác nhận được thanh toán.');
    }
  }

  const isFactory = scope === 'FACTORY';

  return (
    <NppPage>
      <p style={eyebrowStyle}>Công nợ</p>
      <h1 style={pageTitleStyle}>Sổ công nợ NPP</h1>
      <p style={subtitleStyle}>Công nợ xưởng/thợ tự sinh từ đơn hoàn tất. Các khoản thanh toán từ mobile ở trạng thái chờ cho đến khi NPP xác nhận.</p>
      {message ? <p style={{ color: ui.success, fontWeight: 700, background: ui.successSoft, display: 'inline-block', padding: '6px 12px', borderRadius: 8, fontSize: 13 }}>{message}</p> : null}
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ ...panelStyle, marginTop: 16, marginBottom: 18, padding: 0 }}>
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${ui.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, color: ui.text, fontSize: 17, fontWeight: 800 }}>Yêu cầu thanh toán chờ xác nhận</h2>
          <span style={chipStyle(requests.length ? 'warning' : 'success')}>{requests.length} pending</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Mã phiếu', 'Xưởng', 'Đơn hàng', 'Phương thức', 'Số tiền', ''].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 800 }}>{request.code}</td>
                  <td style={tableCellStyle}>{request.factoryName || request.debtPartnerName}</td>
                  <td style={tableCellStyle}>{request.orderCode || '-'}</td>
                  <td style={tableCellStyle}>{methodLabel[request.method] ?? request.method}</td>
                  <td style={tableCellStyle}>{currency(request.amount)}</td>
                  <td style={tableCellStyle}>
                    <button onClick={() => confirmRequest(request)} style={{ ...ghostButtonStyle, color: ui.success }}><CheckCircle2 size={14} /> Xác nhận</button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 ? (
                <tr><td colSpan={6} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Không có yêu cầu thanh toán đang chờ.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '12px 0 16px', flexWrap: 'wrap' }}>
        <button onClick={() => { setScope('FACTORY'); setSelected(null); }} style={{ ...ghostButtonStyle, background: isFactory ? ui.brandSoft : ui.surface, color: isFactory ? ui.brandText : ui.text, borderColor: isFactory ? ui.brand : ui.borderStrong }}>
          Xưởng / thợ phải trả NPP ({factoryDebts.length})
        </button>
        <button onClick={() => { setScope('COMPANY'); setSelected(null); }} style={{ ...ghostButtonStyle, background: !isFactory ? ui.brandSoft : ui.surface, color: !isFactory ? ui.brandText : ui.text, borderColor: !isFactory ? ui.brand : ui.borderStrong }}>
          Công nợ với công ty ({companyDebts.length})
        </button>
      </div>

      <div style={{ ...panelStyle, padding: 18, margin: '0 0 20px', maxWidth: 320 }}>
        <HandCoins size={18} color={ui.danger} />
        <small style={{ display: 'block', color: ui.textMuted, marginTop: 10, fontSize: 12 }}>{isFactory ? 'Tổng còn phải thu từ xưởng' : 'Tổng còn phải trả công ty'}</small>
        <strong style={{ display: 'block', fontSize: 22, color: ui.text }}>{currency(totalOpen)}</strong>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...panelStyle, padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{[isFactory ? 'Xưởng' : 'Công ty', 'Đơn hàng', 'Số tiền', 'Còn lại', 'Trạng thái'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map((d) => {
                  const meta = statusMeta[d.status] ?? statusMeta.OPEN;
                  return (
                    <tr key={d.id} onClick={() => setSelected(d)} style={{ cursor: 'pointer', background: selected?.id === d.id ? ui.brandSoft : 'transparent' }}>
                      <td style={{ ...tableCellStyle, fontWeight: 700 }}>{d.factoryOrgName ?? d.partnerName}</td>
                      <td style={tableCellStyle}>{d.orderCode ?? '-'}</td>
                      <td style={tableCellStyle}>{currency(d.amount)}</td>
                      <td style={tableCellStyle}>{currency(d.amount - d.paidAmount)}</td>
                      <td style={tableCellStyle}><span style={chipStyle(meta.tone)}>{meta.label}</span></td>
                    </tr>
                  );
                })}
                {visible.length === 0 ? <tr><td colSpan={5} style={{ ...tableCellStyle, textAlign: 'center', color: ui.textFaint }}>Chưa có công nợ nào.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>

        <div style={panelStyle}>
          {selected ? (
            <>
              <h2 style={{ margin: '0 0 4px', color: ui.text, fontSize: 18, fontWeight: 800 }}>{selected.factoryOrgName ?? selected.partnerName}</h2>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 13 }}>Đơn hàng: {selected.orderCode ?? '-'}</p>
              <div style={{ display: 'flex', gap: 24, margin: '14px 0' }}>
                <div><small style={{ color: ui.textFaint }}>Tổng nợ</small><p style={{ margin: 0, fontWeight: 800, color: ui.text, fontSize: 18 }}>{currency(selected.amount)}</p></div>
                <div><small style={{ color: ui.textFaint }}>Còn lại</small><p style={{ margin: 0, fontWeight: 800, color: ui.danger, fontSize: 18 }}>{currency(selected.amount - selected.paidAmount)}</p></div>
              </div>
              {isFactory ? (
                <>
                  <label style={labelStyle}>Ghi nhận thanh toán trực tiếp<input style={inputStyle} type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Số tiền" /></label>
                  <button onClick={pay} style={{ ...primaryButtonStyle, width: '100%', marginTop: 10 }}><HandCoins size={14} /> Ghi nhận thanh toán</button>
                </>
              ) : (
                <p style={{ color: ui.textFaint, fontSize: 13, background: ui.surfaceMuted, border: `1px solid ${ui.border}`, borderRadius: 10, padding: 12 }}>Khoản công nợ với công ty do công ty quản lý. NPP chỉ theo dõi tại đây.</p>
              )}
              {selected.note ? <p style={{ color: ui.textFaint, fontSize: 13, marginTop: 14 }}>{selected.note}</p> : null}
            </>
          ) : (
            <p style={{ color: ui.textFaint }}>Chọn một khoản công nợ để xem chi tiết.</p>
          )}
        </div>
      </div>
    </NppPage>
  );
}
