'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { AdminDashboardData, DashboardTone, DemoAdminUser, LoginResponse } from '@eurohouse/types';

type ApiState = { loading: boolean; online: boolean; message: string };

const demoEmail = 'board@eurohouse.vn';
const demoPassword = 'Eurohouse@2026';
const storageKey = 'eurohouse-demo-user';

function toneColor(tone: DashboardTone) {
  return colors[tone];
}

export default function AdminHome() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
  const [apiState, setApiState] = useState<ApiState>({ loading: true, online: false, message: 'Đang kiểm tra API...' });
  const [identifier, setIdentifier] = useState(demoEmail);
  const [password, setPassword] = useState(demoPassword);
  const [user, setUser] = useState<DemoAdminUser | null>(null);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const maxRevenue = useMemo(() => Math.max(...(dashboard?.chart.map((item) => item.revenue) ?? [1])), [dashboard]);

  useEffect(() => {
    const savedUser = window.localStorage.getItem(storageKey);
    if (savedUser) setUser(JSON.parse(savedUser) as DemoAdminUser);
  }, []);

  useEffect(() => {
    let active = true;
    async function checkApi() {
      try {
        const health = await fetch(`${apiUrl}/health`).then((response) => response.json());
        if (!active) return;
        setApiState({ loading: false, online: true, message: health?.status === 'ok' ? 'API đang online.' : 'API phản hồi nhưng trạng thái chưa chuẩn.' });
      } catch (requestError) {
        if (!active) return;
        setApiState({ loading: false, online: false, message: requestError instanceof Error ? requestError.message : 'Không gọi được API public.' });
      }
    }
    void checkApi();
    return () => { active = false; };
  }, [apiUrl]);

  useEffect(() => {
    if (!user) return;
    async function loadDashboard() {
      try {
        setError('');
        const data = await fetch(`${apiUrl}/admin/dashboard`).then((response) => response.json());
        setDashboard(data);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Không tải được dashboard demo.');
      }
    }
    void loadDashboard();
  }, [apiUrl, user]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'Đăng nhập demo thất bại.');
      }
      const payload = (await response.json()) as LoginResponse;
      window.localStorage.setItem(storageKey, JSON.stringify(payload.user));
      setUser(payload.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập demo thất bại.');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    window.localStorage.removeItem(storageKey);
    setUser(null);
    setDashboard(null);
  }

  if (!user) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: colors.white }}>
        <section style={{ background: colors.brandBlack, color: colors.white, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <p style={{ color: colors.brandOrange, fontWeight: 900, letterSpacing: 1 }}>EUROHOUSE ADMIN DEMO</p>
          <h1 style={{ fontSize: 52, lineHeight: 1.05, margin: '12px 0' }}>Bản demo vận hành cho ban lãnh đạo</h1>
          <p style={{ color: colors.brandGrey, fontSize: 18, lineHeight: 1.7 }}>Đăng nhập để kiểm tra dashboard mock, kết nối API public, báo giá mẫu và các module quản trị.</p>
          <div style={{ marginTop: 28, background: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20 }}>
            <p style={{ margin: 0, color: apiState.online ? colors.success : colors.warning, fontWeight: 800 }}>{apiState.loading ? 'Đang kiểm tra API...' : apiState.online ? 'API Online' : 'API Offline'}</p>
            <p style={{ margin: '8px 0 0', color: colors.brandGrey }}>{apiState.message}</p>
            <p style={{ margin: '8px 0 0', color: colors.brandGrey }}>API URL: {apiUrl}</p>
          </div>
        </section>
        <section style={{ padding: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 440, display: 'grid', gap: 16 }}>
            <div>
              <p style={{ color: colors.brandOrange, fontWeight: 900, margin: 0 }}>TÀI KHOẢN DEMO</p>
              <h2 style={{ color: colors.brandBlack, fontSize: 36, margin: '8px 0' }}>Đăng nhập</h2>
              <p style={{ color: colors.brandGrey, lineHeight: 1.6 }}>Dùng sẵn tài khoản bên dưới để vào dashboard demo.</p>
            </div>
            <label style={labelStyle}>Email<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={inputStyle} /></label>
            {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
            <button type="submit" disabled={loading} style={primaryButtonStyle}>{loading ? 'Đang đăng nhập...' : 'Vào dashboard demo'}</button>
            <div style={{ background: colors.orangeSoft, borderRadius: 16, padding: 16, color: colors.brandBlack }}>
              <strong>Thông tin test:</strong><p style={{ margin: '8px 0 0' }}>Email: {demoEmail}</p><p style={{ margin: '4px 0 0' }}>Mật khẩu: {demoPassword}</p>
            </div>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '100vh', background: '#FAFAFA' }}>
      <aside style={{ background: colors.brandBlack, color: colors.white, padding: 28, position: 'sticky', top: 0, height: '100vh' }}>
        <strong style={{ color: colors.brandOrange, fontSize: 24 }}>EUROHOUSE</strong>
        <p style={{ color: colors.brandGrey }}>Xin chào, {user.displayName}</p>
        <button onClick={logout} style={{ ...secondaryButtonStyle, width: '100%', marginTop: 12 }}>Đăng xuất</button>
        <nav style={{ display: 'grid', gap: 12, marginTop: 32 }}>
          {['Tổng quan', 'Người dùng', 'Hệ nhôm', 'Báo giá', 'Bảo hành QR', 'Đơn hàng', 'Loyalty', 'Thư viện'].map((module, index) => (
            <span key={module} style={{ padding: 12, borderRadius: 12, background: index === 0 ? colors.brandOrange : 'transparent', color: index === 0 ? colors.brandBlack : colors.white }}>{module}</span>
          ))}
        </nav>
      </aside>
      <section style={{ padding: 36 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
          <div><p style={{ color: colors.brandOrange, fontWeight: 900, margin: 0 }}>DASHBOARD DEMO</p><h1 style={{ fontSize: 42, margin: '8px 0', color: colors.brandBlack }}>{dashboard?.greeting ?? 'Đang tải dữ liệu...'}</h1><p style={{ color: colors.brandGrey, maxWidth: 820, lineHeight: 1.7 }}>Dữ liệu mock từ API để lãnh đạo kiểm tra giao diện, luồng đăng nhập và khả năng kết nối backend public.</p></div>
          <div style={{ ...panelStyle, minWidth: 260 }}><strong>Trạng thái hệ thống</strong><p style={{ color: apiState.online ? colors.success : colors.danger, fontWeight: 900 }}>{apiState.online ? 'Online' : 'Offline'}</p><small style={{ color: colors.brandGrey }}>{apiUrl}</small></div>
        </div>
        {error ? <p style={{ color: colors.danger }}>{error}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16, marginTop: 28 }}>
          {(dashboard?.summary ?? []).map((card) => (
            <div key={card.title} style={{ background: colors.white, borderRadius: 22, padding: 22, border: `1px solid ${colors.orangeSoft}`, borderTop: `5px solid ${toneColor(card.tone)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><p style={{ margin: 0, color: colors.brandGrey, fontWeight: 800 }}>{card.title}</p><span style={{ color: toneColor(card.tone), fontWeight: 900 }}>{card.change}</span></div>
              <strong style={{ display: 'block', fontSize: 32, color: colors.brandBlack, marginTop: 8 }}>{card.value}</strong><p style={{ margin: '8px 0 0', color: colors.brandBlack }}>{card.description}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, marginTop: 24 }}>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Doanh số & đơn hàng 6 tháng</h2><div style={{ display: 'flex', alignItems: 'end', gap: 14, height: 210, paddingTop: 20 }}>{(dashboard?.chart ?? []).map((point) => (<div key={point.label} style={{ flex: 1, textAlign: 'center' }}><div title={`${point.revenue} triệu`} style={{ height: `${Math.max(24, (point.revenue / maxRevenue) * 170)}px`, background: `linear-gradient(180deg, ${colors.brandOrange}, ${colors.orangeSoft})`, borderRadius: '12px 12px 4px 4px' }} /><strong style={{ display: 'block', marginTop: 8 }}>{point.label}</strong><small style={{ color: colors.brandGrey }}>{point.orders} đơn</small></div>))}</div></div>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Tải phòng ban</h2>{(dashboard?.departments ?? []).map((dept) => (<div key={dept.department} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '12px 0', borderBottom: `1px solid ${colors.orangeSoft}` }}><div><strong>{dept.department}</strong><p style={{ margin: '4px 0 0', color: colors.brandGrey }}>{dept.sla}</p></div><span style={{ color: toneColor(dept.tone), fontWeight: 900 }}>{dept.openTasks} việc</span></div>))}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 24 }}>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Module vận hành</h2>{(dashboard?.modules ?? []).map((module) => (<div key={module.label} style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><strong>{module.label}</strong><span style={{ color: toneColor(module.tone), fontWeight: 900 }}>{module.value}</span></div><p style={{ margin: '4px 0 8px', color: colors.brandGrey }}>{module.note}</p><div style={{ height: 8, background: colors.orangeSoft, borderRadius: 999 }}><div style={{ height: 8, width: `${module.progress}%`, background: toneColor(module.tone), borderRadius: 999 }} /></div></div>))}</div>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Hoạt động gần đây</h2>{(dashboard?.activities ?? []).map((activity) => (<div key={activity.title} style={{ borderBottom: `1px solid ${colors.orangeSoft}`, padding: '12px 0' }}><strong style={{ color: toneColor(activity.tone) }}>● {activity.title}</strong><p style={{ margin: '6px 0', color: colors.brandBlack }}>{activity.description}</p><small style={{ color: colors.brandGrey }}>{activity.time}</small></div>))}</div>
        </div>

        <div style={{ ...panelStyle, marginTop: 24 }}><h2 style={panelTitleStyle}>Đơn hàng gần đây</h2><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr>{['Mã đơn', 'Đại lý', 'NPP', 'Giá trị', 'Trạng thái', 'Tuổi đơn'].map((head) => <th key={head} style={tableHeadStyle}>{head}</th>)}</tr></thead><tbody>{(dashboard?.recentOrders ?? []).map((order) => (<tr key={order.id}><td style={tableCellStyle}>{order.id}</td><td style={tableCellStyle}>{order.dealer}</td><td style={tableCellStyle}>{order.npp}</td><td style={tableCellStyle}>{order.value}</td><td style={tableCellStyle}><span style={{ color: toneColor(order.tone), fontWeight: 900 }}>{order.status}</span></td><td style={tableCellStyle}>{order.age}</td></tr>))}</tbody></table></div></div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: 20, marginTop: 24 }}>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Báo giá mẫu từ API</h2>{dashboard?.quote ? (<div><p style={{ fontSize: 28, fontWeight: 900, color: colors.brandBlack }}>{dashboard.quote.totalKg.toFixed(1)} kg · {dashboard.quote.totalCost.toLocaleString('vi-VN')} đ</p>{dashboard.quote.items.map((item) => (<p key={item.profileCode} style={{ color: colors.brandGrey }}>{item.profileCode} — {item.profileName}: {item.lengthMm}mm × {item.quantity}</p>))}</div>) : null}</div>
          <div style={panelStyle}><h2 style={panelTitleStyle}>Trạng thái kỹ thuật</h2>{(dashboard?.systemStatus ?? []).map((status) => (<div key={status.service} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '12px 0', borderBottom: `1px solid ${colors.orangeSoft}` }}><div><strong>{status.service}</strong><p style={{ margin: '4px 0 0', color: colors.brandGrey }}>{status.note}</p></div><span style={{ color: toneColor(status.tone), fontWeight: 900 }}>{status.status}</span></div>))}</div>
        </div>
      </section>
    </main>
  );
}

const labelStyle = { display: 'grid', gap: 8, color: colors.brandBlack, fontWeight: 800 };
const inputStyle = { border: `2px solid ${colors.orangeSoft}`, borderRadius: 16, padding: 14, fontSize: 16 };
const primaryButtonStyle = { border: 0, borderRadius: 999, background: colors.brandOrange, color: colors.brandBlack, padding: '16px 20px', fontWeight: 900, fontSize: 16, cursor: 'pointer' };
const secondaryButtonStyle = { border: `1px solid ${colors.brandOrange}`, borderRadius: 999, background: 'transparent', color: colors.brandOrange, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' };
const panelStyle = { border: `1px solid ${colors.orangeSoft}`, borderRadius: 22, padding: 24, background: colors.white, boxShadow: '0 12px 30px rgba(21,17,16,0.06)' };
const panelTitleStyle = { color: colors.brandBlack, fontSize: 22, margin: '0 0 16px' };
const tableHeadStyle = { textAlign: 'left' as const, padding: 12, color: colors.brandGrey, borderBottom: `1px solid ${colors.orangeSoft}` };
const tableCellStyle = { padding: 12, borderBottom: `1px solid ${colors.orangeSoft}`, color: colors.brandBlack };
