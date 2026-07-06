'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Headset,
  Layers,
  Package,
  ShieldCheck,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { AdminDashboardData, DashboardTone } from '@eurohouse/types';
import { AdminShell } from '../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../src/auth';
import { apiGet } from '../src/lib/api';
import { chipStyle, eyebrowStyle, pageTitleStyle, panelStyle, panelTitleStyle, subtitleStyle, tableCellStyle, tableHeadStyle, tone, ui } from '../src/ui';

const summaryIcons: LucideIcon[] = [TrendingUp, AlertCircle, Package, ShieldCheck, Layers, Headset];

export default function AdminHome() {
  const { user, ready, login, logout } = useDemoAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');

  const maxRevenue = useMemo(() => Math.max(...(dashboard?.chart.map((item) => item.revenue) ?? [1]), 1), [dashboard]);

  useEffect(() => {
    if (!user) return;
    apiGet<AdminDashboardData>('/admin/dashboard')
      .then(setDashboard)
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'Không tải được dashboard.'));
  }, [user]);

  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;

  return (
    <AdminShell user={user} onLogout={logout}>
      <p style={eyebrowStyle}>DASHBOARD</p>
      <h1 style={pageTitleStyle}>{dashboard?.greeting ?? 'Đang tải dữ liệu...'}</h1>
      <p style={{ ...subtitleStyle, maxWidth: 720 }}>Số liệu vận hành tổng hợp từ API: đơn hàng, báo giá, bảo hành, loyalty và trạng thái hệ thống.</p>
      {error ? <p style={{ color: ui.danger }}>{error}</p> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 20 }}>
        {(dashboard?.summary ?? []).map((card, index) => {
          const t = tone(card.tone as DashboardTone);
          const Icon = summaryIcons[index % summaryIcons.length];
          return (
            <div key={card.title} style={{ ...panelStyle, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: t.soft,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={19} color={t.fg} />
                </span>
                {card.change ? <span style={{ color: t.fg, fontWeight: 700, fontSize: 13 }}>{card.change}</span> : null}
              </div>
              <p style={{ margin: '14px 0 2px', color: ui.textMuted, fontWeight: 600, fontSize: 13 }}>{card.title}</p>
              <strong style={{ display: 'block', fontSize: 26, color: ui.text, letterSpacing: -0.5 }}>{card.value}</strong>
              <p style={{ margin: '6px 0 0', color: ui.textFaint, fontSize: 13 }}>{card.description}</p>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, marginTop: 20 }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Doanh số & đơn hàng 6 tháng</h2>
          <div style={{ display: 'flex', alignItems: 'end', gap: 14, height: 200, paddingTop: 20 }}>
            {(dashboard?.chart ?? []).map((point) => (
              <div key={point.label} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  title={`${point.revenue} triệu`}
                  style={{
                    height: `${Math.max(20, (point.revenue / maxRevenue) * 160)}px`,
                    background: `linear-gradient(180deg, ${ui.brand}, ${ui.brandSoft})`,
                    borderRadius: '10px 10px 4px 4px',
                  }}
                />
                <strong style={{ display: 'block', marginTop: 10, fontSize: 13, color: ui.text }}>{point.label}</strong>
                <small style={{ color: ui.textFaint }}>{point.orders} đơn</small>
              </div>
            ))}
          </div>
        </div>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Tải phòng ban</h2>
          {(dashboard?.departments ?? []).map((dept) => {
            return (
              <div key={dept.department} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '12px 0', borderBottom: `1px solid ${ui.border}` }}>
                <div>
                  <strong style={{ color: ui.text, fontSize: 14 }}>{dept.department}</strong>
                  <p style={{ margin: '2px 0 0', color: ui.textFaint, fontSize: 12 }}>{dept.sla}</p>
                </div>
                <span style={chipStyle(dept.tone as DashboardTone)}>{dept.openTasks} việc</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Module vận hành</h2>
          {(dashboard?.modules ?? []).map((module) => {
            const t = tone(module.tone as DashboardTone);
            return (
              <div key={module.label} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong style={{ color: ui.text, fontSize: 14 }}>{module.label}</strong>
                  <span style={{ color: t.fg, fontWeight: 700, fontSize: 13 }}>{module.value}</span>
                </div>
                <p style={{ margin: '4px 0 8px', color: ui.textFaint, fontSize: 13 }}>{module.note}</p>
                <div style={{ height: 6, background: ui.surfaceMuted, borderRadius: 999 }}>
                  <div style={{ height: 6, width: `${module.progress}%`, background: t.fg, borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>
        <div style={panelStyle}>
          <h2 style={panelTitleStyle}>Hoạt động gần đây</h2>
          {(dashboard?.activities ?? []).length === 0 ? (
            <p style={{ color: ui.textFaint, fontSize: 14 }}>Chưa có hoạt động nào.</p>
          ) : (
            (dashboard?.activities ?? []).map((activity) => {
              const t = tone(activity.tone as DashboardTone);
              return (
                <div key={activity.title} style={{ display: 'flex', gap: 12, borderBottom: `1px solid ${ui.border}`, padding: '12px 0' }}>
                  <Activity size={16} color={t.fg} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <strong style={{ color: ui.text, fontSize: 14 }}>{activity.title}</strong>
                    <p style={{ margin: '4px 0', color: ui.textMuted, fontSize: 13 }}>{activity.description}</p>
                    <small style={{ color: ui.textFaint }}>{activity.time}</small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={panelTitleStyle}>Đơn hàng gần đây</h2>
          <a href="/orders" style={{ color: ui.brandText, fontWeight: 700, fontSize: 14 }}>
            Xem tất cả →
          </a>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã đơn', 'Đại lý', 'NPP', 'Giá trị', 'Trạng thái', 'Tuổi đơn'].map((head) => (
                  <th key={head} style={tableHeadStyle}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(dashboard?.recentOrders ?? []).map((order) => (
                <tr key={order.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 700 }}>{order.id}</td>
                  <td style={tableCellStyle}>{order.dealer}</td>
                  <td style={tableCellStyle}>{order.npp}</td>
                  <td style={tableCellStyle}>{order.value}</td>
                  <td style={tableCellStyle}>
                    <span style={chipStyle(order.tone as DashboardTone)}>{order.status}</span>
                  </td>
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
