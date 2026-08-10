import { ADMIN_MODULES, type DemoAdminUser } from '@eurohouse/types';

/** CEO toàn quyền; user thường chỉ vào module được cấp. */
export function canAccessModule(user: Pick<DemoAdminUser, 'isCeo' | 'modules'> & { permissions?: string[] }, moduleKey: string): boolean {
  if (user.isCeo) return true;
  const legacy = user.modules ?? [];
  const rbac = user.permissions ?? [];
  return legacy.includes(moduleKey) || rbac.includes(moduleKey);
}

/** Suy ra module key từ pathname hiện tại (khớp ADMIN_MODULES theo href). */
export function moduleKeyForPath(pathname: string): string | undefined {
  // Ưu tiên khớp chính xác, sau đó khớp tiền tố (trừ '/').
  const exact = ADMIN_MODULES.find((m) => m.href === pathname);
  if (exact) return exact.key;
  const prefix = ADMIN_MODULES.filter((m) => m.href !== '/').find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );
  return prefix?.key;
}
