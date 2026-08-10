'use client';

import { useEffect, useState } from 'react';
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
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart } from 'recharts';
import { motion } from 'framer-motion';
import { AdminShell } from '../src/AdminShell';
import { LoginScreen, useDemoAuth } from '../src/auth';
import { apiGet } from '../src/lib/api';
import { chipStyle, eyebrowStyle, pageTitleStyle, glassPanelStyle, panelTitleStyle, subtitleStyle, tableCellStyle, tableHeadStyle, tone, ui } from '../src/ui';

const summaryIcons: LucideIcon[] = [TrendingUp, AlertCircle, Package, ShieldCheck, Layers, Headset];

export default function AdminHome() {
  const { user, ready, login, logout } = useDemoAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');



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

      <motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 24 }}>
          {(dashboard?.summary ?? []).map((card, index) => {
            const t = tone(card.tone as DashboardTone);
            const Icon = summaryIcons[index % summaryIcons.length];
            return (
              <motion.div key={card.title} variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={{ ...glassPanelStyle, padding: '24px 32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 16,
                      background: t.soft,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={28} color={t.fg} />
                  </span>
                  {card.change ? <span style={{ color: t.fg, fontWeight: 800, fontSize: 13, background: t.soft, padding: '4px 10px', borderRadius: 20 }}>{card.change}</span> : null}
                </div>
                <p style={{ margin: '20px 0 4px', color: ui.textMuted, fontWeight: 600, fontSize: 14 }}>{card.title}</p>
                <strong style={{ display: 'block', fontSize: 36, color: ui.text, letterSpacing: -1, fontWeight: 800 }}>{card.value}</strong>
                <p style={{ margin: '8px 0 0', color: ui.textFaint, fontSize: 13 }}>{card.description}</p>
              </motion.div>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24, marginTop: 24 }}>
          <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={glassPanelStyle}>
            <h2 style={panelTitleStyle}>Doanh số & đơn hàng 6 tháng</h2>
            <div style={{ width: '100%', height: 250, marginTop: 24 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dashboard?.chart ?? []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={ui.brand} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={ui.brandSoft} stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={ui.border} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: ui.textMuted, fontWeight: 500 }} dy={10} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: ui.textMuted }} tickFormatter={(val) => `${val}tr`} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: ui.shadowLg }} cursor={{ fill: ui.surfaceMuted }} />
                  <Bar yAxisId="left" dataKey="revenue" name="Doanh thu" fill="url(#colorRev)" radius={[8, 8, 0, 0]} barSize={40} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={glassPanelStyle}>
            <h2 style={panelTitleStyle}>Tải phòng ban</h2>
            <div style={{ marginTop: 12 }}>
              {(dashboard?.departments ?? []).map((dept) => {
                return (
                  <div key={dept.department} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '16px 0', borderBottom: `1px solid ${ui.border}` }}>
                    <div>
                      <strong style={{ color: ui.text, fontSize: 15 }}>{dept.department}</strong>
                      <p style={{ margin: '4px 0 0', color: ui.textFaint, fontSize: 13 }}>{dept.sla}</p>
                    </div>
                    <span style={{ ...chipStyle(dept.tone as DashboardTone), padding: '6px 12px', fontSize: 13, height: 'fit-content' }}>{dept.openTasks} việc</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={glassPanelStyle}>
            <h2 style={{...panelTitleStyle, marginBottom: 20}}>Module vận hành</h2>
            {(dashboard?.modules ?? []).map((module) => {
              const t = tone(module.tone as DashboardTone);
              return (
                <div key={module.label} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ color: ui.text, fontSize: 15 }}>{module.label}</strong>
                    <span style={{ color: t.fg, fontWeight: 800, fontSize: 14 }}>{module.value}</span>
                  </div>
                  <p style={{ margin: '6px 0 12px', color: ui.textFaint, fontSize: 13 }}>{module.note}</p>
                  <div style={{ height: 8, background: ui.surfaceMuted, borderRadius: 999, overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${module.progress}%` }} transition={{ duration: 1, delay: 0.2 }} style={{ height: 8, background: t.fg, borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </motion.div>
          <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={glassPanelStyle}>
            <h2 style={{...panelTitleStyle, marginBottom: 20}}>Hoạt động gần đây</h2>
            {(dashboard?.activities ?? []).length === 0 ? (
              <p style={{ color: ui.textFaint, fontSize: 14 }}>Chưa có hoạt động nào.</p>
            ) : (
              (dashboard?.activities ?? []).map((activity) => {
                const t = tone(activity.tone as DashboardTone);
                return (
                  <div key={activity.title} style={{ display: 'flex', gap: 16, borderBottom: `1px solid ${ui.border}`, padding: '16px 0' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: t.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Activity size={18} color={t.fg} />
                    </div>
                    <div>
                      <strong style={{ color: ui.text, fontSize: 15 }}>{activity.title}</strong>
                      <p style={{ margin: '6px 0', color: ui.textMuted, fontSize: 14 }}>{activity.description}</p>
                      <small style={{ color: ui.textFaint, fontWeight: 500 }}>{activity.time}</small>
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        </div>

        <motion.div variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }} style={{ ...glassPanelStyle, marginTop: 24, padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 24px 16px' }}>
            <h2 style={panelTitleStyle}>Đơn hàng gần đây</h2>
            <a href="/orders" style={{ color: ui.brandText, fontWeight: 700, fontSize: 14, padding: '8px 16px', background: ui.brandSoft, borderRadius: 8 }}>
              Xem tất cả →
            </a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
                  {['Mã đơn', 'Đại lý', 'NPP', 'Giá trị', 'Trạng thái', 'Tuổi đơn'].map((head) => (
                    <th key={head} style={{ ...tableHeadStyle, padding: '16px 24px' }}>
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(dashboard?.recentOrders ?? []).map((order) => (
                  <tr key={order.id} style={{ borderTop: `1px solid ${ui.border}` }}>
                    <td style={{ ...tableCellStyle, padding: '16px 24px', fontWeight: 700 }}>{order.id}</td>
                    <td style={{ ...tableCellStyle, padding: '16px 24px', fontWeight: 500 }}>{order.dealer}</td>
                    <td style={{ ...tableCellStyle, padding: '16px 24px', color: ui.textMuted }}>{order.npp}</td>
                    <td style={{ ...tableCellStyle, padding: '16px 24px', fontWeight: 600 }}>{order.value}</td>
                    <td style={{ ...tableCellStyle, padding: '16px 24px' }}>
                      <span style={{ ...chipStyle(order.tone as DashboardTone), padding: '6px 12px', fontWeight: 600 }}>{order.status}</span>
                    </td>
                    <td style={{ ...tableCellStyle, padding: '16px 24px', color: ui.textMuted }}>{order.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AdminShell>
  );
}
