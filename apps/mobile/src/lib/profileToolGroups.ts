export type ProfileToolDefinition = {
  label: string;
  href: string;
  icon: string;
  desc: string;
  fg: string;
  bg: string;
  /** Mở bằng trình duyệt ngoài app. */
  external?: boolean;
};

export type ProfileToolGroup = {
  title: string;
  tools: ProfileToolDefinition[];
};

// Báo giá và Công trình đã có ở trang chủ và thanh tab nên không lặp lại ở đây.
export const profileToolGroups: ProfileToolGroup[] = [
  {
    title: 'Tài liệu',
    tools: [
      { label: 'Kiến thức', href: '/knowledge', icon: 'book-open', desc: 'Cẩm nang và video thi công', fg: '#0369A1', bg: '#E5F3FA' },
      { label: 'Thư viện', href: '/library', icon: 'image', desc: 'Dự án, mẫu cửa, video, catalog', fg: '#5925DC', bg: '#F4F3FF' },
    ],
  },
  {
    title: 'Quản lý',
    tools: [
      { label: 'Công nợ', href: '/debts', icon: 'credit-card', desc: 'NPP, phụ kiện, khách hàng', fg: '#BE123C', bg: '#FDE8EF' },
      { label: 'Tồn kho & đề-xê', href: '/inventory', icon: 'box', desc: 'Cây nguyên, đoạn dư, phế liệu', fg: '#1D4ED8', bg: '#EAF2FF' },
      { label: 'Hồ sơ cơ sở', href: '/edit-profile', icon: 'settings', desc: 'Tên, logo, địa chỉ trên báo giá', fg: '#344054', bg: '#EEF0F3' },
    ],
  },
  {
    title: 'Hỗ trợ',
    tools: [
      { label: 'Bảo hành QR', href: '/warranty', icon: 'maximize', desc: 'Kích hoạt bảo hành cho khách', fg: '#047857', bg: '#E5F7EF' },
      { label: 'Zalo hỗ trợ', href: 'https://zalo.me/eurohouse', icon: 'message-circle', desc: 'Hỗ trợ kỹ thuật', fg: '#1D4ED8', bg: '#EAF2FF', external: true },
      { label: 'Cộng đồng Facebook', href: 'https://www.facebook.com/eurohousemister', icon: 'facebook', desc: 'Hỏi đáp kỹ thuật', fg: '#1D4ED8', bg: '#EAF2FF', external: true },
    ],
  },
];
