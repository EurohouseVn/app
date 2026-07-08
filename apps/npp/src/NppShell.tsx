'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileBarChart,
  HandCoins,
  LayoutGrid,
  LogOut,
  Package,
  Scale,
  type LucideIcon,
} from 'lucide-react';
import type { DemoAdminUser } from '@eurohouse/types';
import { ui } from './ui';

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Tổng quan', href: '/', icon: LayoutGrid },
  { label: 'Đơn hàng', href: '/orders', icon: Package },
  { label: 'Đối chiếu', href: '/reconciliation', icon: Scale },
  { label: 'Công nợ', href: '/debts', icon: HandCoins },
  { label: 'Báo cáo', href: '/reports', icon: FileBarChart },
];

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  NPP: 'Nhà phân phối',
};

export function NppShell({ user, onLogout, children }: { user: DemoAdminUser; onLogout: () => void; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', background: ui.bg }}>
      <aside
        style={{
          background: ui.sidebar,
          borderRight: `1px solid ${ui.border}`,
          padding: '24px 18px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px' }}>
          <Image src="/logo.png" alt="Eurohouse" width={38} height={38} style={{ borderRadius: 10 }} />
          <div>
            <strong style={{ color: ui.text, fontSize: 17, letterSpacing: -0.3 }}>Eurohouse</strong>
            <p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>NPP Web Manager</p>
          </div>
        </div>

        <div
          style={{
            marginTop: 20,
            padding: 14,
            borderRadius: 14,
            background: ui.surfaceMuted,
            border: `1px solid ${ui.border}`,
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: ui.text, fontSize: 14 }}>{user.displayName}</p>
          <p style={{ margin: '4px 0 0', color: ui.brandText, fontSize: 12, fontWeight: 600 }}>{roleLabel[user.role] ?? user.role}</p>
        </div>

        <nav style={{ display: 'grid', gap: 4, marginTop: 20, flex: 1 }}>
          {navItems.map((item, index) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={`${item.label}-${index}`}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: 14,
                  background: active ? ui.brandSoft : 'transparent',
                  color: active ? ui.brandText : ui.textMuted,
                }}
              >
                <Icon size={18} strokeWidth={2} color={active ? ui.brand : ui.textFaint} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={onLogout}
          style={{
            marginTop: 12,
            width: '100%',
            border: `1px solid ${ui.border}`,
            borderRadius: 10,
            background: 'transparent',
            color: ui.textMuted,
            padding: '10px 12px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <LogOut size={17} /> Đăng xuất
        </button>
      </aside>
      <section style={{ padding: 32, maxWidth: 1280, width: '100%' }}>{children}</section>
    </main>
  );
}
