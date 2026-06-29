'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { colors } from '@eurohouse/ui';
import type { DemoAdminUser } from '@eurohouse/types';

const navItems = [
  { label: 'Tổng quan', href: '/' },
  { label: 'Đơn hàng', href: '/orders' },
  { label: 'Người dùng', href: '/users' },
  { label: 'Hệ nhôm', href: '/catalog' },
  { label: 'Báo giá', href: '/quote' },
  { label: 'Khuyến mãi', href: '/promotions' },
  { label: 'Loyalty', href: '/loyalty' },
  { label: 'Thư viện', href: '/library' },
];

export function AdminShell({ user, onLogout, children }: { user: DemoAdminUser; onLogout: () => void; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '264px 1fr', minHeight: '100vh', background: '#F5F6F8' }}>
      <aside style={{ background: colors.brandBlack, color: colors.white, padding: 24, position: 'sticky', top: 0, height: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Image src="/logo.png" alt="Eurohouse" width={40} height={40} style={{ borderRadius: 10, background: '#fff' }} />
          <div>
            <strong style={{ color: colors.brandOrange, fontSize: 20 }}>EUROHOUSE</strong>
            <p style={{ margin: 0, color: colors.brandGrey, fontSize: 12 }}>Web Admin</p>
          </div>
        </div>
        <div style={{ marginTop: 20, padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.06)' }}>
          <p style={{ margin: 0, fontWeight: 800 }}>{user.displayName}</p>
          <p style={{ margin: '4px 0 0', color: colors.brandGrey, fontSize: 12 }}>{user.role}</p>
        </div>
        <nav style={{ display: 'grid', gap: 8, marginTop: 24 }}>
          {navItems.map((item, index) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            return (
              <Link key={`${item.label}-${index}`} href={item.href} style={{ padding: 12, borderRadius: 12, textDecoration: 'none', fontWeight: 700, background: active ? colors.brandOrange : 'transparent', color: active ? colors.brandBlack : colors.white }}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={onLogout} style={{ marginTop: 24, width: '100%', border: `1px solid ${colors.brandOrange}`, borderRadius: 999, background: 'transparent', color: colors.brandOrange, padding: '12px 16px', fontWeight: 800, cursor: 'pointer' }}>
          Đăng xuất
        </button>
      </aside>
      <section style={{ padding: 32 }}>{children}</section>
    </main>
  );
}
