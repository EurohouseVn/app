'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileBarChart,
  FileText,
  Gift,
  HandCoins,
  Image as ImageIcon,
  LayoutGrid,
  LogOut,
  Megaphone,
  Package,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Users,
  UserCog,
  Wallet,
  Warehouse,
  Target,
  FileCheck2,
  Banknote,
  Search,
  Factory,
  Wrench,
  MonitorPlay,
  ActivitySquare,
  Building2,
  Store,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import type { DemoAdminUser } from '@eurohouse/types';
import { canAccessModule, moduleKeyForPath } from './access';
import { ui } from './ui';

const navGroups = [
  {
    title: 'Hệ thống',
    items: [
      { label: 'Tổng quan', href: '/', icon: LayoutGrid, moduleKey: 'dashboard' },
      { label: 'Người dùng', href: '/users', icon: Users, moduleKey: 'users' },
      { label: 'Chức danh', href: '/roles', icon: UserCog, moduleKey: 'roles' },
    ]
  },
  {
    title: 'Kinh Doanh & CRM',
    items: [
      { label: 'Mảng dự án', href: '/sales/projects', icon: Building2, moduleKey: 'sales-projects' },
      { label: 'Nhà phân phối', href: '/sales/distributors', icon: Store, moduleKey: 'sales-npp' },
      { label: 'Xưởng sản xuất', href: '/sales/factories', icon: Factory, moduleKey: 'sales-factories' },
      { label: 'Đơn hàng', href: '/orders', icon: Package, moduleKey: 'orders' },
      { label: 'Xưởng tiềm năng', href: '/sales/leads', icon: Search, moduleKey: 'sales-leads' },
      { label: 'Báo cáo sale', href: '/sales/reports', icon: FileCheck2, moduleKey: 'sales-reports' },
      { label: 'Theo dõi doanh số', href: '/sales/targets', icon: Target, moduleKey: 'sales-targets' },
    ]
  },
  {
    title: 'Sản Xuất (MES)',
    items: [
      { label: 'Dashboard SX', href: '/production/dashboard', icon: ActivitySquare, moduleKey: 'prod-dashboard' },
      { label: 'Lệnh sản xuất', href: '/production/work-orders', icon: Factory, moduleKey: 'prod-work-orders' },
      { label: 'Xưởng Kiosk', href: '/production/shop-floor', icon: MonitorPlay, moduleKey: 'prod-shop-floor' },
      { label: 'Khuôn đùn', href: '/production/dies', icon: Wrench, moduleKey: 'prod-dies' },
      { label: 'Hệ nhôm', href: '/catalog', icon: LayoutGrid, moduleKey: 'catalog' },
      { label: 'Quản lý Công thức', href: '/formulas', icon: LayoutGrid, moduleKey: 'formulas' },
      { label: 'Kho 500+ Mẫu Cửa', href: '/door-models-filter', icon: LayoutGrid, moduleKey: 'formulas' },
    ]
  },
  {
    title: 'Kế Toán & Kho',
    items: [
      { label: 'Bảng giá & Báo giá', href: '/accounting/pricing', icon: FileText, moduleKey: 'accounting-pricing' },
      { label: 'Kho NVL', href: '/inventory', icon: Warehouse, moduleKey: 'inventory' },
      { label: 'Công nợ', href: '/debts', icon: HandCoins, moduleKey: 'debts' },
      { label: 'Thu chi', href: '/cashflow', icon: Wallet, moduleKey: 'cashflow' },
      { label: 'Bảng lương', href: '/payroll', icon: Banknote, moduleKey: 'payroll' },
      { label: 'Báo cáo tài chính', href: '/reports', icon: FileBarChart, moduleKey: 'reports' },
    ]
  },
  {
    title: 'Marketing & CSKH',
    items: [
      { label: 'Bảo hành', href: '/warranties', icon: ShieldCheck, moduleKey: 'warranties' },
      { label: 'Khuyến mãi', href: '/promotions', icon: Megaphone, moduleKey: 'promotions' },
      { label: 'Loyalty', href: '/loyalty', icon: Gift, moduleKey: 'loyalty' },
      { label: 'Thư viện', href: '/library', icon: ImageIcon, moduleKey: 'library' },
      { label: 'Kiến thức', href: '/knowledge', icon: FileText, moduleKey: 'library' },
    ]
  }
];

const roleLabel: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  STAFF: 'Nhân viên',
  NPP: 'Nhà phân phối',
  DAILY: 'Đại lý',
  FACTORY: 'Xưởng sản xuất',
};

export function AdminShell({ user, onLogout, children }: { user: DemoAdminUser; onLogout: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const moduleKey = moduleKeyForPath(pathname ?? '/');
  const allowed = !moduleKey || canAccessModule(user, moduleKey);

  // Initialize expanded state: if a group contains the active item, open it.
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>(() => {
    const initialState: Record<number, boolean> = {};
    navGroups.forEach((group, idx) => {
      const hasActive = group.items.some(
        (item) => item.href === '/' ? pathname === '/' : pathname === item.href || pathname?.startsWith(`${item.href}/`)
      );
      if (hasActive) {
        initialState[idx] = true;
      }
    });
    return initialState;
  });

  const toggleGroup = (idx: number) => {
    setOpenGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '260px 1fr', minHeight: '100vh', background: ui.bg, position: 'relative', zIndex: 1 }}>
      {/* AI Ambient Glow Light (Mesh Gradient effect) */}
      <div style={{ position: 'fixed', top: '-10%', left: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(ellipse at center, rgba(234, 179, 8, 0.15) 0%, transparent 60%)', filter: 'blur(80px)', zIndex: -1, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '-20%', right: '-10%', width: '60vw', height: '60vh', background: 'radial-gradient(ellipse at center, rgba(59, 130, 246, 0.08) 0%, transparent 60%)', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }} />
      {/* Grid Pattern Light */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%230f172a\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', zIndex: -1, pointerEvents: 'none' }} />
      <aside
        style={{
          background: ui.sidebar,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: `1px solid ${ui.border}`,
          padding: '24px 18px',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '1px 0 20px rgba(0,0,0,0.02)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 6px' }}>
          <Image src="/logo.png" alt="Eurohouse" width={42} height={42} style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(212, 175, 55, 0.2)' }} />
          <div>
            <strong style={{ color: ui.text, fontSize: 18, letterSpacing: '-0.02em', fontFamily: 'var(--font-heading)' }}>Eurohouse</strong>
            <p style={{ margin: 0, color: ui.brandText, fontSize: 12, fontWeight: 600 }}>Web Admin Pro</p>
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            padding: 16,
            borderRadius: 16,
            background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
            border: `1px solid ${ui.border}`,
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, color: ui.text, fontSize: 14, letterSpacing: '-0.01em' }}>{user.displayName}</p>
          <p style={{ margin: '4px 0 0', color: ui.brand, fontSize: 12, fontWeight: 600 }}>
            {user.isCeo ? 'CEO — Toàn quyền' : user.jobTitle || roleLabel[user.role] || user.role}
          </p>
          {user.departmentName ? (
            <p style={{ margin: '4px 0 0', color: ui.textMuted, fontSize: 11, fontWeight: 500 }}>{user.departmentName}</p>
          ) : null}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24, flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {navGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(item => canAccessModule(user, item.moduleKey));
            if (visibleItems.length === 0) return null;

            return (
              <div key={groupIdx}>
                <div 
                  onClick={() => toggleGroup(groupIdx)}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    fontSize: 11, 
                    fontWeight: 700, 
                    textTransform: 'uppercase', 
                    color: ui.textFaint, 
                    letterSpacing: '0.05em', 
                    marginBottom: 8, 
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {group.title}
                  {openGroups[groupIdx] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
                {openGroups[groupIdx] && (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {visibleItems.map((item, index) => {
                      const active =
                        item.href === '/'
                          ? pathname === '/'
                          : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={`${item.label}-${index}`}
                          href={item.href}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderRadius: 12,
                            fontWeight: active ? 700 : 600,
                            fontSize: 14,
                            background: active ? ui.brandSoft : 'transparent',
                            color: active ? ui.brandText : ui.textMuted,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: active ? '0 2px 8px rgba(212, 175, 55, 0.15)' : 'none',
                          }}
                          onMouseOver={(e) => !active && (e.currentTarget.style.color = ui.text)}
                          onMouseOut={(e) => !active && (e.currentTarget.style.color = ui.textMuted)}
                        >
                          <Icon size={18} strokeWidth={active ? 2.5 : 2} color={active ? ui.brand : ui.textFaint} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <button
          onClick={onLogout}
          style={{
            marginTop: 16,
            width: '100%',
            border: `1px solid ${ui.border}`,
            borderRadius: 12,
            background: ui.surface,
            color: ui.textMuted,
            padding: '12px 14px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = ui.dangerSoft)}
          onMouseOut={(e) => (e.currentTarget.style.background = ui.surface)}
        >
          <LogOut size={18} color={ui.textFaint} /> Đăng xuất
        </button>
      </aside>
      <section style={{ padding: 36, maxWidth: 1440, width: '100%', margin: '0 auto' }}>
        {allowed ? children : <NoAccess />}
      </section>
    </main>
  );
}

function NoAccess() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        color: ui.textMuted,
      }}
    >
      <span
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: ui.dangerSoft,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          boxShadow: '0 8px 32px rgba(220, 38, 38, 0.1)',
        }}
      >
        <ShieldAlert size={36} color={ui.danger} />
      </span>
      <h2 style={{ color: ui.text, fontSize: 24, margin: '0 0 8px', fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}>
        Bạn không có quyền truy cập
      </h2>
      <p style={{ margin: 0, maxWidth: 400, fontSize: 15, lineHeight: 1.5 }}>
        Chức năng này chưa được cấp cho tài khoản của bạn. Vui lòng liên hệ CEO hoặc quản trị hệ thống để được cấp quyền.
      </p>
    </div>
  );
}
