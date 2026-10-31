import { globalNavigationRoutes } from './public-routes';

export const site = {
  name: 'Nhôm Eurohouse',
  brand: 'EUROHOUSE',
  url: 'https://nhomeurohouse.com',
  description:
    'Nền tảng nhôm kiến trúc và nhôm công nghiệp Eurohouse: hệ cửa cao cấp, profile kỹ thuật, catalog và giải pháp dành cho công trình.',
  phone: '0221 3900 899',
  phoneHref: 'tel:+842213900899',
  email: 'vneurohouse@gmail.com',
  address: 'Km số 2, đường 196, Yên Tập, Mỹ Hào, Hưng Yên',
  legalName: 'LELOI EXIM GLOBAL',
} as const;

export const navigation = globalNavigationRoutes
  .filter((route) => route.kind !== 'portal' && !['home', 'search'].includes(route.id))
  .map(({ href, label }) => ({ href, label }));
