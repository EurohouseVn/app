// Danh mục tiện ích ở trang chủ (homeActions.test.ts). Không import React để chạy được bằng node --test.

export type HomeActionKey =
  | 'orders' | 'quote' | 'formulas' | 'projects' | 'workforce' | 'debts' | 'invoices'
  | 'shopFloor' | 'qc' | 'installations' | 'warranty' | 'mediaSync' | 'reminders' | 'all';

export type HomeActionGroup = 'production' | 'business';

export interface HomeAction {
  key: HomeActionKey;
  label: string;
  /** Tên icon Feather. */
  icon: string;
  href: string;
  color: string;
  bg: string;
  group: HomeActionGroup;
  /** Quyền Eurohouse cần mở. */
  requires?: 'ordering' | 'formulas';
}

export const HOME_ACTIONS: HomeAction[] = [
  { key: 'orders', label: 'Đặt nhôm', icon: 'truck', href: '/orders', color: '#C45513', bg: '#FFF1E8', group: 'production', requires: 'ordering' },
  { key: 'formulas', label: 'Công thức', icon: 'layout', href: '/formulas', color: '#0F766E', bg: '#E6F6F3', group: 'production', requires: 'formulas' },
  { key: 'shopFloor', label: 'Việc xưởng', icon: 'clipboard', href: '/shop-floor', color: '#344054', bg: '#EEF0F3', group: 'production' },
  { key: 'qc', label: 'Kiểm tra QC', icon: 'check-square', href: '/qc', color: '#047857', bg: '#E5F7EF', group: 'production' },
  { key: 'installations', label: 'Lắp đặt', icon: 'tool', href: '/installations', color: '#B45309', bg: '#FFF4D8', group: 'production' },
  { key: 'warranty', label: 'Bảo hành', icon: 'maximize', href: '/service-warranty', color: '#0369A1', bg: '#E5F3FA', group: 'production' },
  { key: 'mediaSync', label: 'Ảnh chờ gửi', icon: 'cloud', href: '/media-sync', color: '#475467', bg: '#F2F4F7', group: 'production' },
  { key: 'quote', label: 'Báo giá', icon: 'file-text', href: '/quote', color: '#1D4ED8', bg: '#EAF2FF', group: 'business' },
  { key: 'projects', label: 'Công trình', icon: 'briefcase', href: '/projects', color: '#C45513', bg: '#FFF1E8', group: 'business' },
  { key: 'workforce', label: 'Quản lý xưởng', icon: 'user-check', href: '/workforce', color: '#047857', bg: '#E5F7EF', group: 'business' },
  { key: 'reminders', label: 'Nhắc việc', icon: 'calendar', href: '/reminders', color: '#B45309', bg: '#FFF4D8', group: 'business' },
  { key: 'debts', label: 'Công nợ', icon: 'credit-card', href: '/debts', color: '#BE123C', bg: '#FDE8EF', group: 'business' },
  { key: 'invoices', label: 'Hoá đơn', icon: 'file-text', href: '/invoices', color: '#5925DC', bg: '#F4F3FF', group: 'business' },
];

const ALL_TILE: HomeAction = { key: 'all', label: 'Tất cả', icon: 'grid', href: '', color: '#344054', bg: '#EEF0F3', group: 'business' };

const PRIMARY: HomeActionKey[] = ['orders', 'quote', 'formulas', 'projects', 'workforce', 'debts', 'invoices'];

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
