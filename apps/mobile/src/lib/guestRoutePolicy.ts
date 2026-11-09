export type GuestRouteDecision =
  | 'ALLOW_LOCAL'
  | 'ALLOW_PUBLIC_READ'
  | 'REQUIRE_ACCOUNT'
  | 'REQUIRE_EUROHOUSE_FEATURE';

const LOCAL_ROUTES = new Set(['/weather', '/workforce', '/quote']);
const PUBLIC_ROUTES = new Set(['/catalog', '/library', '/knowledge', '/promo']);
const EUROHOUSE_ROUTES = new Set(['/orders', '/my-orders', '/formulas']);

export function guestRouteDecision(pathname: string): GuestRouteDecision {
  const path = `/${pathname.split('?')[0].split('/').filter(Boolean)[0] ?? ''}`;
  if (LOCAL_ROUTES.has(path)) return 'ALLOW_LOCAL';
  if (PUBLIC_ROUTES.has(path)) return 'ALLOW_PUBLIC_READ';
  if (EUROHOUSE_ROUTES.has(path)) return 'REQUIRE_EUROHOUSE_FEATURE';
  return 'REQUIRE_ACCOUNT';
}
