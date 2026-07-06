import { colors } from '@eurohouse/ui';

export const statusText: Record<string, string> = {
  NEW: 'Mới',
  RECEIVED_BY_NPP: 'NPP tiếp nhận',
  SENT_TO_ADMIN: 'Gửi công ty',
  PROCESSING: 'Đang xử lý',
  PARTIAL: 'Giao một phần',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  OVERDUE: 'Chậm xử lý',
};

export const statusTone: Record<string, string> = {
  NEW: colors.brandOrange,
  RECEIVED_BY_NPP: colors.success,
  SENT_TO_ADMIN: colors.brandBlack,
  PROCESSING: colors.warning,
  PARTIAL: colors.warning,
  COMPLETED: colors.success,
  CANCELLED: colors.danger,
  OVERDUE: colors.danger,
};
