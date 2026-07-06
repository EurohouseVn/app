import FeatherBase from '@expo/vector-icons/Feather';
import { colors } from '@eurohouse/ui';

// Ép kiểu một lần để tránh xung đột @types/react (2 bản trong monorepo).
// Đây chỉ là vấn đề type của tsc, runtime Feather hoạt động bình thường.
const Feather = FeatherBase as unknown as React.ComponentType<{ name: string; size?: number; color?: string }>;

// Danh sách tên icon hợp lệ (Feather) dùng trong app.
export type IconName =
  | 'home' | 'grid' | 'sliders' | 'image' | 'user' | 'bell' | 'box' | 'package'
  | 'gift' | 'maximize' | 'maximize-2' | 'zap' | 'layers' | 'file-text' | 'credit-card'
  | 'settings' | 'trending-up' | 'award' | 'chevron-right' | 'chevron-left' | 'chevron-up'
  | 'chevron-down' | 'minus' | 'plus' | 'send' | 'book-open' | 'play' | 'play-circle'
  | 'file' | 'star' | 'tool' | 'smartphone' | 'shopping-bag' | 'briefcase'
  | 'arrow-up-circle' | 'arrow-down-circle' | 'check-circle' | 'check' | 'camera' | 'save'
  | 'square' | 'columns' | 'sidebar' | 'repeat' | 'arrow-left' | 'arrow-right' | 'download' | 'log-out' | 'edit-2';

export function Icon({ name, size = 22, color = colors.brandBlack }: { name: IconName; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

// Helper cho tab bar (giữ cast Feather trong một file duy nhất).
export function tabBarIcon(name: IconName) {
  return ({ color, focused }: { color: string; focused: boolean }) => (
    <Feather name={name} size={focused ? 24 : 22} color={color} />
  );
}
