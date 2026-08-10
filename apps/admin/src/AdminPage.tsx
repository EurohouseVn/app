'use client';

import type { ReactNode } from 'react';
import { AdminShell } from './AdminShell';
import { LoginScreen, useDemoAuth } from './auth';

/**
 * Bọc một trang admin: tự xử lý đăng nhập demo + khung sidebar.
 * Guard quyền module nằm trong AdminShell (áp cho cả trang dùng AdminShell trực tiếp).
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
