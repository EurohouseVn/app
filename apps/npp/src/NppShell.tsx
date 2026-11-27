'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ClipboardCheck,
  Factory,
  FileBarChart,
  FileScan,
  FileText,
  HandCoins,
  LayoutGrid,
  LogOut,
  Package,
  Printer,
  Receipt,
  Scale,
  ScanLine,
  Settings,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { DemoAdminUser } from '@eurohouse/types';
import { ui } from './ui';

const navItems: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Tổng quan', href: '/', icon: LayoutGrid },
  { label: 'Đơn hàng', href: '/orders', icon: Package },
  { label: 'Cơ sở SX', href: '/factories', icon: Factory },
  { label: 'Kho hàng', href: '/inventory', icon: Warehouse },
  { label: 'Phụ kiện', href: '/accessories', icon: Package },
  { label: 'Kính', href: '/glass', icon: LayoutGrid },
  { label: 'Quét mã', href: '/scan', icon: ScanLine },
  { label: 'Kiểm kê', href: '/stocktake', icon: ClipboardCheck },
  { label: 'Đọc phiếu', href: '/documents', icon: FileScan },
  { label: 'Trạm in', href: '/print-station', icon: Printer },
  { label: 'Báo giá', href: '/quotations', icon: FileText },
  { label: 'Công trình', href: '/projects', icon: Building2 },
  { label: 'Bảng giá màu', href: '/prices', icon: FileText },
  { label: 'Đối chiếu', href: '/reconciliation', icon: Scale },
  { label: 'Công nợ', href: '/debts', icon: HandCoins },
  { label: 'Hoá đơn', href: '/invoices', icon: Receipt },
  { label: 'Báo cáo', href: '/reports', icon: FileBarChart },
  { label: 'Tài khoản', href: '/profile', icon: Settings },
];

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  NPP: 'Nhà phân phối',
};

export function NppShell({ user, onLogout, children }: { user: DemoAdminUser; onLogout: () => void; children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="npp-shell" style={{ display: 'grid', gridTemplateColumns: '240px minmax(0, 1fr)', minHeight: '100vh', background: ui.bg }}>
      <aside
        className="npp-sidebar"
        style={{
          background: ui.sidebar,
          borderRight: `1px solid ${ui.border}`,
          padding: '24px 18px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="npp-brand" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px' }}>
          <Image src="/logo.png" alt="Eurohouse" width={38} height={38} style={{ borderRadius: 10 }} />
          <div>
            <strong style={{ color: ui.text, fontSize: 17 }}>Eurohouse</strong>
            <p style={{ margin: 0, color: ui.textMuted, fontSize: 12 }}>NPP Web Manager</p>
          </div>
        </div>

        <div className="npp-user-card" style={{ marginTop: 20, padding: 14, borderRadius: 14, background: ui.surfaceMuted, border: `1px solid ${ui.border}` }}>
          <p style={{ margin: 0, fontWeight: 700, color: ui.text, fontSize: 14 }}>{user.displayName}</p>
          <p style={{ margin: '4px 0 0', color: ui.brandText, fontSize: 12, fontWeight: 600 }}>{roleLabel[user.role] ?? user.role}</p>
        </div>

        <nav className="npp-nav" style={{ display: 'grid', gap: 4, marginTop: 20, flex: 1 }}>
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="npp-nav-link"
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
          className="npp-logout"
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
      <section className="npp-content" style={{ padding: '28px clamp(16px, 2.2vw, 40px)', maxWidth: 1920, width: '100%', minWidth: 0 }}>{children}</section>
    </main>
  );
}
