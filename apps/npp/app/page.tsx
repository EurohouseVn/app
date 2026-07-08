'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, HandCoins, Package, TrendingUp, Warehouse } from 'lucide-react';
import type { NppDashboardData } from '@eurohouse/types';
import { NppPage } from '../src/NppPage';
import { apiGet } from '../src/lib/api';
import { currency, eyebrowStyle, pageTitleStyle, panelStyle, subtitleStyle, ui } from '../src/ui';

const statusLabel: Record<string, string> = {
  NEW: 'Mới',
  RECEIVED_BY_NPP: 'Đã tiếp nhận',
  SENT_TO_ADMIN: 'Đã gửi công ty',
  PROCESSING: 'Đang xử lý',
  PARTIAL: 'Giao một phần',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export default function NppHome() {
  const [data, setData] = useState<NppDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<NppDashboardData>('/npp/dashboard')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Không tải được dashboard.'));
  }, []);

  const totalOrders = data ? Object.values(data.ordersByStatus).reduce((s, v) => s + v, 0) : 0;

  return (
    <NppPage>
      <p style={eyebrowStyle}>DASHBOARD</p>
      <h1 style={pageTitleStyle}>Tổng quan NPP</h1>
      <p style={subtitleStyle}>Số liệu vận hành: đơn hàng, xưởng quản lý, công nợ và doanh thu tháng này.</p>
      {error ? <p style={{ color: ui.danger, fontWeight: 700 }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginTop: 20 }}>
        <div style={{ ...panelStyle, padding: 20 }}>
          <Package size={20} color={ui.brand} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Tổng đơn hàng</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{totalOrders}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <Warehouse size={20} color={ui.teal} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Xưởng quản lý</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{data?.managedFactoryCount ?? 0}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <HandCoins size={20} color={ui.danger} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Công nợ còn mở</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{currency((data?.openDebtTotal ?? 0) - (data?.openDebtPaid ?? 0))}</strong>
        </div>
        <div style={{ ...panelStyle, padding: 20 }}>
          <TrendingUp size={20} color={ui.success} />
          <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>Doanh thu tháng này</p>
          <strong style={{ display: 'block', fontSize: 26, color: ui.text }}>{currency(data?.monthRevenue ?? 0)}</strong>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 20 }}>
        <h2 style={{ color: ui.text, fontSize: 17, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={ui.textMuted} /> Đơn hàng theo trạng thái
        </h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {Object.entries(data?.ordersByStatus ?? {}).map(([status, count]) => (
            <div key={status} style={{ border: `1px solid ${ui.border}`, borderRadius: 12, padding: '12px 18px', minWidth: 140 }}>
              <p style={{ margin: 0, color: ui.textMuted, fontSize: 12, fontWeight: 600 }}>{statusLabel[status] ?? status}</p>
              <strong style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 20, color: ui.text, marginTop: 4 }}>
                <CheckCircle2 size={15} color={ui.brand} /> {count}
              </strong>
            </div>
          ))}
          {Object.keys(data?.ordersByStatus ?? {}).length === 0 ? (
            <p style={{ color: ui.textFaint }}>Chưa có đơn hàng nào.</p>
          ) : null}
        </div>
      </div>
    </NppPage>
  );
}
