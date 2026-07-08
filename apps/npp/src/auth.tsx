'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { Building2, Lock, LogIn, Mail } from 'lucide-react';
import type { DemoAdminUser, LoginResponse } from '@eurohouse/types';
import { ui } from './ui';

const storageKey = 'eurohouse-npp-user';
const allowedRoles = new Set(['NPP', 'ADMIN']);

export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Token JWT hiện tại, đọc từ localStorage (chỉ chạy phía trình duyệt). */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  const saved = window.localStorage.getItem(storageKey);
  if (!saved) return null;
  try {
    return (JSON.parse(saved) as DemoAdminUser).token ?? null;
  } catch {
    return null;
  }
}

/** Xoá phiên đăng nhập (gọi khi API trả 401). */
export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey);
}

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
  const [identifier, setIdentifier] = useState('npp@eurohouse.vn');
  const [password, setPassword] = useState('Eurohouse@2026');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? 'Đăng nhập thất bại.');
      }
      const payload = (await response.json()) as LoginResponse;
      if (!allowedRoles.has(payload.user.role)) {
        throw new Error('Tài khoản này không có quyền truy cập NPP Web Manager.');
      }
      onSuccess(payload.user);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  const fieldWrap: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    border: `1px solid ${ui.borderStrong}`,
    borderRadius: 12,
    padding: '0 14px',
    background: ui.surface,
  };
  const fieldInput: CSSProperties = {
    border: 0,
    outline: 'none',
    padding: '14px 0',
    fontSize: 15,
    width: '100%',
    color: ui.text,
    background: 'transparent',
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.05fr 1fr', background: ui.bg }}>
      {/* Bên trái: giới thiệu, nền gradient teal→cam dịu */}
      <section
        style={{
          background: `linear-gradient(150deg, #0B3B37 0%, #0E5C54 45%, #12756B 100%)`,
          color: '#fff',
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: 'rgba(247,144,9,0.18)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '8px 16px', fontWeight: 700, letterSpacing: 0.5 }}>
            <Building2 size={18} color={ui.brand} /> EUROHOUSE NPP
          </div>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, margin: '24px 0 16px', fontWeight: 800 }}>NPP Web Manager</h1>
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 1.7, maxWidth: 440 }}>
            Theo dõi đơn hàng, đối chiếu số liệu theo Xưởng, công nợ và báo cáo tài chính riêng của NPP.
          </p>
        </div>
      </section>

      {/* Bên phải: form đăng nhập */}
      <section style={{ padding: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 400, display: 'grid', gap: 18 }}>
          <div>
            <h2 style={{ color: ui.text, fontSize: 30, margin: 0, fontWeight: 800 }}>Đăng nhập</h2>
            <p style={{ color: ui.textMuted, margin: '8px 0 0', fontSize: 15 }}>Vui lòng nhập thông tin tài khoản của bạn.</p>
          </div>

          <label style={{ display: 'grid', gap: 8, color: ui.text, fontWeight: 600, fontSize: 14 }}>
            Email hoặc số điện thoại
            <div style={fieldWrap}>
              <Mail size={18} color={ui.textFaint} />
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} style={fieldInput} placeholder="npp@eurohouse.vn" />
            </div>
          </label>

          <label style={{ display: 'grid', gap: 8, color: ui.text, fontWeight: 600, fontSize: 14 }}>
            Mật khẩu
            <div style={fieldWrap}>
              <Lock size={18} color={ui.textFaint} />
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={fieldInput} placeholder="••••••••" />
            </div>
          </label>

          {error ? (
            <p style={{ color: ui.danger, margin: 0, background: ui.dangerSoft, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}>{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            style={{
              border: 0,
              borderRadius: 12,
              background: ui.brand,
              color: '#fff',
              padding: '14px 20px',
              fontWeight: 700,
              fontSize: 15,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            <LogIn size={18} /> {loading ? 'Đang đăng nhập...' : 'Vào hệ thống'}
          </button>

          <div style={{ background: ui.surfaceMuted, border: `1px solid ${ui.border}`, borderRadius: 12, padding: 16, color: ui.textMuted, fontSize: 13, lineHeight: 1.7 }}>
            <strong style={{ color: ui.text }}>Tài khoản demo</strong>
            <p style={{ margin: '6px 0 0' }}>NPP: npp@eurohouse.vn</p>
            <p style={{ margin: '2px 0 0' }}>Mật khẩu: Eurohouse@2026</p>
          </div>
        </form>
      </section>
    </main>
  );
}
