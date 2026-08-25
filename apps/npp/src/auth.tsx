'use client';

import { FormEvent, useEffect, useState, type CSSProperties } from 'react';
import { Building2, Eye, EyeOff, Lock, LogIn, Mail, Trash2 } from 'lucide-react';
import type { DemoAdminUser, LoginResponse } from '@eurohouse/types';
import { ui } from './ui';

const storageKey = 'eurohouse-npp-user';
const rememberedLoginKey = 'eurohouse-npp-remember-login';
const allowedRoles = new Set(['NPP', 'ADMIN']);
const authClearedEvent = 'eurohouse:npp-auth-cleared';
const authChangedEvent = 'eurohouse:npp-auth-changed';

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
  window.dispatchEvent(new Event(authClearedEvent));
}

export function waitForToken(timeoutMs = 60_000): Promise<string | null> {
  const current = getToken();
  if (current || typeof window === 'undefined') return Promise.resolve(current);
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      window.removeEventListener(authChangedEvent, finish);
      window.removeEventListener(authClearedEvent, finish);
      resolve(getToken());
    };
    const timer = window.setTimeout(finish, timeoutMs);
    window.addEventListener(authChangedEvent, finish, { once: true });
    window.addEventListener(authClearedEvent, finish, { once: true });
  });
}

export function useDemoAuth() {
  const [user, setUser] = useState<DemoAdminUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (saved) setUser(JSON.parse(saved) as DemoAdminUser);
    setReady(true);
    const handleAuthCleared = () => setUser(null);
    window.addEventListener(authClearedEvent, handleAuthCleared);
    return () => window.removeEventListener(authClearedEvent, handleAuthCleared);
  }, []);

  function login(value: DemoAdminUser) {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
    window.dispatchEvent(new Event(authChangedEvent));
    setUser(value);
  }

  function logout() {
    window.localStorage.removeItem(storageKey);
    setUser(null);
  }

  return { user, ready, login, logout };
}

export function LoginScreen({ onSuccess }: { onSuccess: (user: DemoAdminUser) => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(rememberedLoginKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { identifier?: string };
      if (parsed.identifier) setIdentifier(parsed.identifier);
      setRememberPassword(true);
    } catch {
      window.localStorage.removeItem(rememberedLoginKey);
    }
  }, []);

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
      if (rememberPassword) {
        window.localStorage.setItem(rememberedLoginKey, JSON.stringify({ identifier: identifier.trim() }));
      } else {
        window.localStorage.removeItem(rememberedLoginKey);
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
  const fieldAction: CSSProperties = {
    border: 0,
    background: 'transparent',
    color: ui.textMuted,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
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
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} style={fieldInput} placeholder="npp@eurohouse.vn" autoComplete="username" onFocus={(event) => event.currentTarget.select()} />
            </div>
          </label>

          <label style={{ display: 'grid', gap: 8, color: ui.text, fontWeight: 600, fontSize: 14 }}>
            Mật khẩu
            <div style={fieldWrap}>
              <Lock size={18} color={ui.textFaint} />
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} style={fieldInput} placeholder="••••••••" autoComplete="current-password" onFocus={(event) => event.currentTarget.select()} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} style={fieldAction} title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button type="button" onClick={() => setPassword('')} style={fieldAction} title="Xóa mật khẩu">
                <Trash2 size={17} />
              </button>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: ui.textMuted, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <input type="checkbox" checked={rememberPassword} onChange={(event) => setRememberPassword(event.target.checked)} />
            Nhớ email; mật khẩu do trình duyệt quản lý
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

        </form>
      </section>
    </main>
  );
}
