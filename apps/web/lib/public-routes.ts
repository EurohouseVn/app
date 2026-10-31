import type { WebsiteProductFamily } from '@eurohouse/types';

export type PublicRouteKind =
  | 'home'
  | 'family'
  | 'content'
  | 'resource'
  | 'company'
  | 'support'
  | 'portal';

export type PublicRoute = {
  id: string;
  label: string;
  href: string;
  canonicalPath: string;
  kind: PublicRouteKind;
  external?: boolean;
  dynamic?: boolean;
  family?: WebsiteProductFamily;
};

const homeRoute = {
  id: 'home',
  label: 'Trang chủ',
  href: '/',
  canonicalPath: '/',
  kind: 'home',
} as const satisfies PublicRoute;

export const familyRoutes = [
  {
    id: 'residential',
    label: 'NHÔM DÂN DỤNG',
    href: '/nhom-dan-dung',
    canonicalPath: '/nhom-dan-dung',
    kind: 'family',
    family: 'RESIDENTIAL',
  },
  {
    id: 'industrial',
    label: 'NHÔM CÔNG NGHIỆP',
    href: '/nhom-cong-nghiep',
    canonicalPath: '/nhom-cong-nghiep',
    kind: 'family',
    family: 'INDUSTRIAL',
  },
] as const satisfies readonly PublicRoute[];

export const globalNavigationRoutes = [
  homeRoute,
  ...familyRoutes,
  {
    id: 'projects',
    label: 'Dự án',
    href: '/du-an',
    canonicalPath: '/du-an',
    kind: 'content',
  },
  {
    id: 'capability',
    label: 'Năng lực',
    href: '/nang-luc',
    canonicalPath: '/nang-luc',
    kind: 'content',
  },
  {
    id: 'resources',
    label: 'Tài nguyên',
    href: '/tai-nguyen',
    canonicalPath: '/tai-nguyen',
    kind: 'resource',
  },
  {
    id: 'distributors',
    label: 'Nhà phân phối',
    href: '/nha-phan-phoi',
    canonicalPath: '/nha-phan-phoi',
    kind: 'company',
  },
  {
    id: 'contact',
    label: 'Liên hệ',
    href: '/lien-he',
    canonicalPath: '/lien-he',
    kind: 'company',
  },
  {
    id: 'search',
    label: 'Tìm kiếm',
    href: '/tim-kiem',
    canonicalPath: '/tim-kiem',
    kind: 'content',
  },
  {
    id: 'npp-sign-in',
    label: 'Đăng nhập NPP',
    href: 'https://npp.nhomeurohouse.com',
    canonicalPath: 'https://npp.nhomeurohouse.com',
    kind: 'portal',
    external: true,
  },
] as const satisfies readonly PublicRoute[];

export const residentialContentRoutes = [
  route('residential-product', 'Dòng sản phẩm dân dụng', '/nhom-dan-dung/dong-san-pham/[slug]', 'content', true),
  route('residential-specialist-system', 'Hệ chuyên dụng', '/nhom-dan-dung/he-chuyen-dung/[slug]', 'content', true),
  route('residential-solution', 'Giải pháp dân dụng', '/nhom-dan-dung/giai-phap/[slug]', 'content', true),
  route('residential-projects', 'Dự án dân dụng', '/nhom-dan-dung/du-an', 'content'),
  route('residential-compare', 'So sánh hệ nhôm', '/nhom-dan-dung/so-sanh', 'content'),
] as const satisfies readonly PublicRoute[];

export const industrialContentRoutes = [
  route('industrial-drawing-profile', 'Định hình theo bản vẽ', '/nhom-cong-nghiep/dinh-hinh-theo-ban-ve', 'content'),
  route('industrial-machine-parts', 'Chi tiết máy', '/nhom-cong-nghiep/chi-tiet-may', 'content'),
  route('industrial-solar', 'Nhôm năng lượng mặt trời', '/nhom-cong-nghiep/nang-luong-mat-troi', 'content'),
  route('industrial-extrusion', 'Đùn thuê', '/nhom-cong-nghiep/dun-thue', 'content'),
  route('industrial-fabrication', 'Gia công nhôm', '/nhom-cong-nghiep/gia-cong', 'content'),
  route('industrial-process', 'Quy trình công nghiệp', '/nhom-cong-nghiep/quy-trinh', 'content'),
  route('industrial-rfq', 'Gửi bản vẽ', '/yeu-cau-bao-gia-cong-nghiep', 'content'),
] as const satisfies readonly PublicRoute[];

export const projectRoutes = [
  route('project-detail', 'Chi tiết dự án', '/du-an/[slug]', 'content', true),
] as const satisfies readonly PublicRoute[];

export const capabilityRoutes = [
  route('capability-factory', 'Nhà máy', '/nang-luc/nha-may', 'content'),
  route('capability-quality', 'Công nghệ và kiểm soát chất lượng', '/nang-luc/cong-nghe-kiem-soat-chat-luong', 'content'),
  route('capability-finishes', 'Bề mặt và màu sắc', '/nang-luc/be-mat-mau-sac', 'content'),
  route('capability-dies', 'Khuôn đùn', '/nang-luc/khuon-dun', 'content'),
  route('capability-video', 'Video năng lực', '/nang-luc/video', 'content'),
] as const satisfies readonly PublicRoute[];

export const resourceRoutes = [
  route('resource-catalog', 'Catalog', '/tai-nguyen/catalog', 'resource'),
  route('resource-profile', 'Hồ sơ năng lực', '/tai-nguyen/profile', 'resource'),
  route('resource-technical', 'Tài liệu kỹ thuật', '/tai-nguyen/tai-lieu-ky-thuat', 'resource'),
  route('resource-video', 'Thư viện video', '/tai-nguyen/video', 'resource'),
  route('resource-video-detail', 'Chi tiết video', '/tai-nguyen/video/[slug]', 'resource', true),
  route('knowledge', 'Kiến thức', '/kien-thuc', 'resource'),
  route('knowledge-detail', 'Bài viết kiến thức', '/kien-thuc/[slug]', 'resource', true),
  route('faq', 'Câu hỏi thường gặp', '/cau-hoi-thuong-gap', 'resource'),
] as const satisfies readonly PublicRoute[];

export const companyRoutes = [
  route('distributor-policy', 'Chính sách nhà phân phối', '/nha-phan-phoi/chinh-sach', 'company'),
  route('distributor-register', 'Đăng ký nhà phân phối', '/nha-phan-phoi/dang-ky', 'company'),
  route('about', 'Về EUROHOUSE', '/ve-eurohouse', 'company'),
] as const satisfies readonly PublicRoute[];

export const stablePublicRoutes = [
  route('support', 'Hỗ trợ', '/support', 'support'),
  route('privacy', 'Quyền riêng tư', '/privacy', 'support'),
  route('terms', 'Điều khoản', '/terms', 'support'),
  route('delete-account', 'Xóa tài khoản', '/delete-account', 'support'),
] as const satisfies readonly PublicRoute[];

export const publicRouteManifest = [
  ...globalNavigationRoutes,
  ...residentialContentRoutes,
  ...industrialContentRoutes,
  ...projectRoutes,
  ...capabilityRoutes,
  ...resourceRoutes,
  ...companyRoutes,
  ...stablePublicRoutes,
] as const satisfies readonly PublicRoute[];

function route(
  id: string,
  label: string,
  canonicalPath: `/${string}`,
  kind: PublicRouteKind,
  dynamic = false,
): PublicRoute {
  return {
    id,
    label,
    href: canonicalPath,
    canonicalPath,
    kind,
    ...(dynamic ? { dynamic: true } : {}),
  };
}
