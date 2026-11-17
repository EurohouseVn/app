export type ProfileToolDefinition = {
  label: string;
  href: string;
  icon: string;
  desc: string;
  fg: string;
};

export type ProfileToolGroup = {
  title: string;
  tools: ProfileToolDefinition[];
};

export const profileToolGroups: ProfileToolGroup[] = [
  {
    title: 'Kiến thức & tài liệu',
    tools: [
      { label: 'Kiến thức', href: '/knowledge', icon: 'book-open', desc: 'Cẩm nang & hướng dẫn thi công', fg: '#0284C7' },
      { label: 'Catalog sản phẩm', href: '/library?tab=PRODUCT_CATALOG', icon: 'download', desc: 'Xem và tải catalog mới nhất', fg: '#F97316' },
      { label: 'Thư viện', href: '/library', icon: 'image', desc: 'Mẫu cửa & hình ảnh từ Eurohouse', fg: '#9333EA' },
    ],
  },
  {
    title: 'Kinh doanh & vận hành',
    tools: [
      { label: 'Báo giá tự động', href: '/quote', icon: 'file-text', desc: 'Sinh báo giá chào khách', fg: '#2F6FED' },
      { label: 'Công trình', href: '/projects', icon: 'layers', desc: 'Quản lý tiến độ & lợi nhuận', fg: '#F97316' },
      { label: 'Công nợ', href: '/debts', icon: 'credit-card', desc: 'NPP, phụ kiện, khách hàng', fg: '#DC2626' },
      { label: 'Tồn kho & Đề xê', href: '/inventory', icon: 'box', desc: 'Quản lý kho nhôm & phế liệu', fg: '#0090FF' },
    ],
  },
  {
    title: 'Tài khoản & hỗ trợ',
    tools: [
      { label: 'Cấu hình báo giá / Hồ sơ', href: '/edit-profile', icon: 'settings', desc: 'Tên cơ sở, logo, địa chỉ', fg: '#475467' },
      { label: 'Bảo hành QR', href: '/warranty', icon: 'maximize', desc: 'Kích hoạt & tích điểm', fg: '#039855' },
      { label: 'Đổi quà tích luỹ', href: '/loyalty', icon: 'gift', desc: 'Xem điểm và đổi quà tặng', fg: '#8833FF' },
      { label: 'Cộng đồng Facebook', href: 'https://www.facebook.com/eurohouse', icon: 'facebook', desc: 'Giao lưu & hỏi đáp kỹ thuật', fg: '#1877F2' },
      { label: 'Zalo Support (OA)', href: 'https://zalo.me/eurohouse', icon: 'message-circle', desc: 'Hỗ trợ kỹ thuật 24/7', fg: '#0068FF' },
    ],
  },
];
