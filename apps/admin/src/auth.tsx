'use client';

import { FormEvent, useEffect, useState } from 'react';
import { colors } from '@eurohouse/ui';
import type { DemoAdminUser, LoginResponse } from '@eurohouse/types';

const storageKey = 'eurohouse-demo-user';

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export function useDemoAuth() {
  const [user, setUser] = useState<DemoAdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setUser(JSON.parse(saved) as DemoAdminUser);
    setReady(true);
  }, []);

  function login(value: DemoAdminUser) {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
    setUser(value);
  }

  function logout() {
    window.localStorage.removeItem(storageKey);
    setUser(null);
  }

  return { user, ready, login, logout };
}

export function LoginScreen({ onSuccess }: { onSuccess: (user: DemoAdminUser) => void }) {
  const [identifier, setIdentifier] = useState('board@eurohouse.vn');
  const [password, setPassword] = useState('Eurohouse@2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      onSuccess(payload.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập demo thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr', background: colors.white }}>
      <section style={{ background: colors.brandBlack, color: colors.white, padding: 56, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <p style={{ color: colors.brandOrange, fontWeight: 900, letterSpacing: 1 }}>EUROHOUSE ADMIN</p>
        <h1 style={{ fontSize: 48, lineHeight: 1.05, margin: '12px 0' }}>Hệ thống quản trị vận hành</h1>
        <p style={{ color: colors.brandGrey, fontSize: 17, lineHeight: 1.7 }}>Theo dõi đơn hàng từ xưởng, NPP và toàn bộ hệ thống Eurohouse trên một màn hình.</p>
      </section>
      <section style={{ padding: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 420, display: 'grid', gap: 16 }}>
          <h2 style={{ color: colors.brandBlack, fontSize: 34, margin: 0 }}>Đăng nhập</h2>
          <label style={{ display: 'grid', gap: 8, color: colors.brandBlack, fontWeight: 800 }}>Email<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} style={{ border: `2px solid ${colors.orangeSoft}`, borderRadius: 16, padding: 14, fontSize: 16 }} /></label>
          <label style={{ display: 'grid', gap: 8, color: colors.brandBlack, fontWeight: 800 }}>Mật khẩu<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={{ border: `2px solid ${colors.orangeSoft}`, borderRadius: 16, padding: 14, fontSize: 16 }} /></label>
          {error ? <p style={{ color: colors.danger, margin: 0 }}>{error}</p> : null}
          <button type="submit" disabled={loading} style={{ border: 0, borderRadius: 999, background: colors.brandOrange, color: colors.brandBlack, padding: '16px 20px', fontWeight: 900, fontSize: 16, cursor: 'pointer' }}>{loading ? 'Đang đăng nhập...' : 'Vào hệ thống'}</button>
          <div style={{ background: colors.orangeSoft, borderRadius: 16, padding: 16, color: colors.brandBlack }}>
            <strong>Tài khoản demo:</strong>
            <p style={{ margin: '8px 0 0' }}>Admin: board@eurohouse.vn</p>
            <p style={{ margin: '4px 0 0' }}>Xưởng: minh@xuong.vn · NPP: vietanh@npp.vn</p>
            <p style={{ margin: '4px 0 0' }}>Mật khẩu chung: Eurohouse@2026</p>
          </div>
        </form>
      </section>
    </main>
  );
}
