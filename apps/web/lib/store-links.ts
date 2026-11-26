/**
 * Liên kết tải ứng dụng Eurohouse. Khi CH Play duyệt xong, đổi `live` của android thành true:
 * mã QR và nút tải sẽ tự bật, không phải sửa chỗ khác.
 */
export type StoreId = 'ios' | 'android';

export type StoreLink = { id: StoreId; name: string; action: string; href: string; live: boolean };

export const storeLinks: StoreLink[] = [
  { id: 'ios', name: 'App Store', action: 'Tải trên', href: 'https://apps.apple.com/vn/app/id6838774785', live: true },
  { id: 'android', name: 'Google Play', action: 'Tải trên', href: 'https://play.google.com/store/apps/details?id=com.nhomeurohouse.app', live: false },
];
