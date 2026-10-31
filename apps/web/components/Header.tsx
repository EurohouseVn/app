'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { globalNavigationRoutes } from '@/lib/public-routes';

const primaryNavigation = globalNavigationRoutes.filter((route) =>
  ['residential', 'industrial', 'projects', 'capability', 'resources'].includes(route.id),
);
const portalRoute = globalNavigationRoutes.find((route) => route.id === 'npp-sign-in');
const contactRoute = globalNavigationRoutes.find((route) => route.id === 'contact');

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link className="brand" href="/" aria-label="EUROHOUSE — Trang chủ" onClick={() => setOpen(false)}>
          <Image className="brand-symbol" src="/brand/logo-mark.png" alt="" width={46} height={46} priority />
          <span className="brand-lockup" aria-hidden="true">
            <strong><b>EURO</b><i>H</i>OUSE</strong>
            <small>NHÔM CỦA SỰ THỊNH VƯỢNG</small>
          </span>
        </Link>

        <button
          ref={toggleRef}
          className="menu-toggle"
          type="button"
          aria-label={open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'}
          aria-controls="primary-navigation"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}
        </button>

        <nav id="primary-navigation" className={open ? 'main-nav is-open' : 'main-nav'} aria-label="Điều hướng chính">
          <div className="main-nav-links">
            {primaryNavigation.map((item) => (
              <Link
                key={item.id}
                className={isActive(item.href) ? 'active' : ''}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="main-nav-actions">
            {portalRoute ? <a className="nav-portal" href={portalRoute.href}>Cổng NPP <ArrowUpRight size={14} aria-hidden="true" /></a> : null}
            {contactRoute ? <Link className="nav-consult" href={contactRoute.href} onClick={() => setOpen(false)}>Nhận tư vấn</Link> : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
