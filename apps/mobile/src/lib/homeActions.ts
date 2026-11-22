// Danh mục tiện ích ở trang chủ (homeActions.test.ts). Không import React để chạy được bằng node --test.

export type HomeActionKey =
  | 'orders' | 'quote' | 'formulas' | 'projects' | 'workforce' | 'debts' | 'invoices'
  | 'shopFloor' | 'qc' | 'installations' | 'warranty' | 'mediaSync' | 'reminders' | 'assistant' | 'all';

export type HomeActionGroup = 'production' | 'business';

export interface HomeAction {
  key: HomeActionKey;
  label: string;
  /** Tên icon Feather. */
  icon: string;
  href: string;
  group: HomeActionGroup;
  /** Việc chính của CSSX: tô cam theo bộ nhận diện (cam chỉ dành cho hành động chính). */
  primary?: boolean;
  /** Quyền Eurohouse cần mở. */
  requires?: 'ordering' | 'formulas';
}

export const HOME_ACTIONS: HomeAction[] = [
  { key: 'orders', label: 'Đặt nhôm', icon: 'truck', href: '/orders', group: 'production', requires: 'ordering', primary: true },
  { key: 'formulas', label: 'Công thức', icon: 'sliders', href: '/formulas', group: 'production', requires: 'formulas' },
  { key: 'shopFloor', label: 'Việc xưởng', icon: 'clipboard', href: '/shop-floor', group: 'production' },
  { key: 'qc', label: 'Kiểm tra QC', icon: 'check-square', href: '/qc', group: 'production' },
  { key: 'installations', label: 'Lắp đặt', icon: 'tool', href: '/installations', group: 'production' },
  { key: 'warranty', label: 'Bảo hành', icon: 'maximize', href: '/service-warranty', group: 'production' },
  { key: 'mediaSync', label: 'Ảnh chờ gửi', icon: 'cloud', href: '/media-sync', group: 'production' },
  { key: 'quote', label: 'Báo giá', icon: 'file-text', href: '/quote', group: 'business', primary: true },
  { key: 'projects', label: 'Công trình', icon: 'briefcase', href: '/projects', group: 'business' },
  { key: 'workforce', label: 'Quản lý xưởng', icon: 'users', href: '/workforce', group: 'business' },
  { key: 'reminders', label: 'Nhắc việc', icon: 'calendar', href: '/reminders', group: 'business' },
  { key: 'assistant', label: 'Trợ lý Bé Eu', icon: 'message-circle', href: '/assistant', group: 'business' },
  { key: 'debts', label: 'Công nợ', icon: 'credit-card', href: '/debts', group: 'business' },
  { key: 'invoices', label: 'Hoá đơn', icon: 'file', href: '/invoices', group: 'business' },
];

const ALL_TILE: HomeAction = { key: 'all', label: 'Tất cả', icon: 'grid', href: '', group: 'business' };

const PRIMARY: HomeActionKey[] = ['quote', 'orders', 'projects', 'formulas', 'workforce', 'debts', 'invoices'];

export function primaryActions(): HomeAction[] {
  return [...PRIMARY.map((key) => HOME_ACTIONS.find((a) => a.key === key)!), ALL_TILE];
}

export function actionGroups(): Array<{ title: string; actions: HomeAction[] }> {
  return [
    { title: 'Sản xuất', actions: HOME_ACTIONS.filter((a) => a.group === 'production') },
    { title: 'Kinh doanh & quản lý', actions: HOME_ACTIONS.filter((a) => a.group === 'business') },
  ];
}

export function isActionLocked(action: HomeAction, access: { ordering: boolean; formulas: boolean }): boolean {
  if (action.requires === 'ordering') return !access.ordering;
  if (action.requires === 'formulas') return !access.formulas;
  return false;
}

export type TileTone = 'primary' | 'neutral' | 'locked';

/** Màu ô tiện ích: cam cho việc chính, trung tính cho phần còn lại, xám khi chưa mở quyền. */
export function tileTone(action: HomeAction, access: { ordering: boolean; formulas: boolean }): TileTone {
  if (isActionLocked(action, access)) return 'locked';
  return action.primary ? 'primary' : 'neutral';
}
