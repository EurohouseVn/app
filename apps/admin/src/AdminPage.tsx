'use client';

import type { ReactNode } from 'react';
import { AdminShell } from './AdminShell';
import { LoginScreen, useDemoAuth } from './auth';

/**
 * Bọc một trang admin: tự xử lý đăng nhập demo + khung sidebar.
 * Dùng cho mọi trang mới để tránh lặp boilerplate auth/shell.
 */
export function AdminPage({ children }: { children: ReactNode }) {
  const { user, ready, login, logout } = useDemoAuth();
  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;
  return (
    <AdminShell user={user} onLogout={logout}>
      {children}
    </AdminShell>
  );
}
