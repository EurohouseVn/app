'use client';

import { NppPage } from '../../src/NppPage';
import { EurohouseAccessPanel } from '../../src/components/EurohouseAccessPanel';
import { eyebrowStyle, pageTitleStyle, subtitleStyle } from '../../src/ui';

export default function NppFactoriesPage() {
  return <NppPage>
    <p style={eyebrowStyle}>CƠ SỞ SẢN XUẤT</p>
    <h1 style={pageTitleStyle}>Quyền sử dụng Eurohouse</h1>
    <p style={subtitleStyle}>Quản lý riêng quyền Công thức cắt và Đặt hàng Nhôm Eurohouse cho từng cơ sở. Mỗi mã mời chỉ dành cho đúng cơ sở và đúng các quyền đã chọn.</p>
    <EurohouseAccessPanel />
  </NppPage>;
}
