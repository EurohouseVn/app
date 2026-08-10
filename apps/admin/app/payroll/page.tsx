'use client';
import React, { useEffect, useState } from 'react';
import { apiGet } from '../../src/lib/api';
import { ui, pageTitleStyle, panelStyle, tableHeadStyle, tableCellStyle, subtitleStyle, chipStyle } from '../../src/ui';

interface PayrollItem {
  id: string;
  month: string;
  baseSalary: number;
  commission: number;
  bonus: number;
  deductions: number;
  netPay: number;
  status: string;
  note: string;
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayroll();
  }, []);

  async function fetchPayroll() {
    setLoading(true);
    try {
      const data = await apiGet<PayrollItem[]>('/admin/sales/payroll');
      setPayrolls(data);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(val: number) {
    return val.toLocaleString('vi-VN') + ' đ';
  }

  function renderStatus(status: string) {
    if (status === 'PAID') return <span style={chipStyle('success')}>Đã thanh toán</span>;
    if (status === 'PUBLISHED') return <span style={chipStyle('warning')}>Chờ thanh toán</span>;
    return <span style={chipStyle('brandBlack')}>Bản nháp</span>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, paddingBottom: 100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={pageTitleStyle}>Bảng Lương Cá Nhân</h1>
        <p style={subtitleStyle}>Xem chi tiết lương, thưởng, hoa hồng doanh số hàng tháng</p>
      </div>

      <div style={panelStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={tableHeadStyle}>Kỳ Lương (Tháng)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Lương cơ bản</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Hoa hồng (Sale)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thưởng khác</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Giảm trừ</th>
              <th style={{ ...tableHeadStyle, textAlign: 'right' }}>Thực nhận (Net)</th>
              <th style={{ ...tableHeadStyle, textAlign: 'center' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {loading && payrolls.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Đang tải...</td></tr>
            ) : payrolls.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: ui.textMuted }}>Bạn chưa có phiếu lương nào được công bố.</td></tr>
            ) : payrolls.map((p) => (
              <tr key={p.id}>
                <td style={{ ...tableCellStyle, fontWeight: 700, color: ui.brandText }}>{p.month}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right' }}>{formatCurrency(p.baseSalary)}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', color: ui.success }}>+{formatCurrency(p.commission)}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', color: ui.success }}>+{formatCurrency(p.bonus)}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', color: ui.danger }}>-{formatCurrency(p.deductions)}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', fontWeight: 800, color: ui.blue, fontSize: 16 }}>{formatCurrency(p.netPay)}</td>
                <td style={{ ...tableCellStyle, textAlign: 'center' }}>{renderStatus(p.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
