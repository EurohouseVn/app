'use client';

import type { ReactNode } from 'react';
import { NppShell } from './NppShell';
import { LoginScreen, useDemoAuth } from './auth';

/**
 * Bọc một trang NPP: tự xử lý đăng nhập + khung sidebar.
 * Dùng cho mọi trang để tránh lặp boilerplate auth/shell.
 */
export function NppPage({ children }: { children: ReactNode }) {
  const { user, ready, login, logout } = useDemoAuth();
  if (!ready) return null;
  if (!user) return <LoginScreen onSuccess={login} />;
  return (
    <NppShell user={user} onLogout={logout}>
      {children}
    </NppShell>
  );
}
