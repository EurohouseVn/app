'use client';

import { useEffect, useMemo, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { AdminDashboardData, DashboardTone } from '@eurohouse/types';
import { AdminShell } from '../src/AdminShell';
import { LoginScreen, apiUrl, useDemoAuth } from '../src/auth';

function toneColor(tone: DashboardTone) {
  return colors[tone];
}

export default function AdminHome() {
  const { user, ready, login, logout } = useDemoAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');

  const maxRevenue = useMemo(() => Math.max(...(dashboard?.chart.map((item) => item.revenue) ?? [1])), [dashboard]);

  useEffect(() => {
    if (!user) return;
    fetch(`${apiUrl}/admin/dashboard`)
      .then((response) => response.json())
      .then(setDashboard)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Không tải được dashboard.'));
  }, [user]);

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={{ color: colors.brandOrange, fontWeight: 900, margin: 0 }}>DASHBOARD</p>
      <h1 style={{ fontSize: 38, margin: '8px 0', color: colors.brandBlack }}>{dashboard?.greeting ?? 'Đang tải dữ liệu...'}</h1>
      <p style={{ color: colors.brandGrey, maxWidth: 820, lineHeight: 1.7 }}>Số liệu vận hành tổng hợp từ API: đơn hàng, báo giá, bảo hành, loyalty và trạng thái hệ thống.</p>
      {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 24 }}>
        {(dashboard?.summary ?? []).map((card) => (
          <div key={card.title} style={{ background: colors.white, borderRadius: 20, padding: 22, border: `1px solid ${colors.orangeSoft}`, borderTop: `5px solid ${toneColor(card.tone)}`, boxShadow: '0 10px 26px rgba(21,17,16,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <p style={{ margin: 0, color: colors.brandGrey, fontWeight: 800 }}>{card.title}</p>
              <span style={{ color: toneColor(card.tone), fontWeight: 900 }}>{card.change}</span>
            </div>
            <strong style={{ display: 'block', fontSize: 30, color: colors.brandBlack, marginTop: 8 }}>{card.value}</strong>
            <p style={{ margin: '8px 0 0', color: colors.brandBlack }}>{card.description}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, marginTop: 24 }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Doanh số & đơn hàng 6 tháng</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 14, height: 210, paddingTop: 20 }}>
            {(dashboard?.chart ?? []).map((point) => (
              <div key={point.label} style={{ flex: 1, textAlign: 'center' }}>
                <div title={`${point.revenue} triệu`} style={{ height: `${Math.max(24, (point.revenue / maxRevenue) * 170)}px`, background: `linear-gradient(180deg, ${colors.brandOrange}, ${colors.orangeSoft})`, borderRadius: '12px 12px 4px 4px' }} />
                <strong style={{ display: 'block', marginTop: 8 }}>{point.label}</strong>
                <small style={{ color: colors.brandGrey }}>{point.orders} đơn</small>
              </div>
            ))}
          </div>
        </div>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Tải phòng ban</h2>
          {(dashboard?.departments ?? []).map((dept) => (
            <div key={dept.department} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '12px 0', borderBottom: `1px solid ${colors.orangeSoft}` }}>
              <div><strong>{dept.department}</strong><p style={{ margin: '4px 0 0', color: colors.brandGrey }}>{dept.sla}</p></div>
              <span style={{ color: toneColor(dept.tone), fontWeight: 900 }}>{dept.openTasks} việc</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Module vận hành</h2>
          {(dashboard?.modules ?? []).map((module) => (
            <div key={module.label} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{module.label}</strong><span style={{ color: toneColor(module.tone), fontWeight: 900 }}>{module.value}</span></div>
              <p style={{ margin: '4px 0 8px', color: colors.brandGrey }}>{module.note}</p>
              <div style={{ height: 8, background: colors.orangeSoft, borderRadius: 999 }}><div style={{ height: 8, width: `${module.progress}%`, background: toneColor(module.tone), borderRadius: 999 }} /></div>
            </div>
          ))}
        </div>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Hoạt động gần đây</h2>
          {(dashboard?.activities ?? []).map((activity) => (
            <div key={activity.title} style={{ borderBottom: `1px solid ${colors.orangeSoft}`, padding: '12px 0' }}>
              <strong style={{ color: toneColor(activity.tone) }}>● {activity.title}</strong>
              <p style={{ margin: '6px 0', color: colors.brandBlack }}>{activity.description}</p>
              <small style={{ color: colors.brandGrey }}>{activity.time}</small>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={panelTitleStyle}>Đơn hàng gần đây</h2>
          <a href="/orders" style={{ color: colors.brandOrange, fontWeight: 800, textDecoration: 'none' }}>Xem tất cả →</a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Mã đơn', 'Đại lý', 'NPP', 'Giá trị', 'Trạng thái', 'Tuổi đơn'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr></thead>
            <tbody>
              {(dashboard?.recentOrders ?? []).map((order) => (
                <tr key={order.id}>
                  <td style={tableCellStyle}>{order.id}</td>
                  <td style={tableCellStyle}>{order.dealer}</td>
                  <td style={tableCellStyle}>{order.npp}</td>
                  <td style={tableCellStyle}>{order.value}</td>
                  <td style={tableCellStyle}><span style={{ color: toneColor(order.tone), fontWeight: 900 }}>{order.status}</span></td>
                  <td style={tableCellStyle}>{order.age}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

const panelStyle = { border: `1px solid ${colors.orangeSoft}`, borderRadius: 20, padding: 24, background: colors.white, boxShadow: '0 10px 26px rgba(21,17,16,0.05)' };
const panelTitleStyle = { color: colors.brandBlack, fontSize: 20, margin: '0 0 16px' };
const tableHeadStyle = { textAlign: 'left' as const, padding: 12, color: colors.brandGrey, borderBottom: `1px solid ${colors.orangeSoft}` };
const tableCellStyle = { padding: 12, borderBottom: `1px solid ${colors.orangeSoft}`, color: colors.brandBlack };
