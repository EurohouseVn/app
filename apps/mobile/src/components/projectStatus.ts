import type { IconName } from './Icon';
import type { ProjectStatus } from '../lib/projectListState';

// Nhãn, màu và icon trạng thái công trình dùng chung cho danh sách và chi tiết.
export const PROJECT_STATUS: Record<ProjectStatus, { label: string; text: string; bg: string; icon: IconName }> = {
  OPEN: { label: 'Báo giá', text: '#1D4ED8', bg: '#EFF4FF', icon: 'file-text' },
  IN_PROGRESS: { label: 'Đang thi công', text: '#B54708', bg: '#FFFAEB', icon: 'briefcase' },
  DONE: { label: 'Hoàn tất', text: '#067647', bg: '#ECFDF3', icon: 'check-circle' },
  CANCELLED: { label: 'Đã huỷ', text: '#475467', bg: '#F2F4F7', icon: 'circle' },
};
