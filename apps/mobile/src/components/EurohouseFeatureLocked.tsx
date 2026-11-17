import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@eurohouse/ui';
import type { EurohouseFeatureKey } from '@eurohouse/types';
import { AppHeader } from './AppHeader';
import { Icon } from './Icon';

const copy: Record<EurohouseFeatureKey, { title: string; detail: string }> = {
  FORMULA_CUTTING: {
    title: 'Module đang xây dựng',
    detail: 'Công thức cắt Eurohouse được mở riêng khi cơ sở được NPP hoặc Eurohouse kích hoạt.',
  },
  EUROHOUSE_ORDERING: {
    title: 'Tính năng này chỉ áp dụng cho CSSX đang sản xuất Nhôm Eurohouse.',
    detail: 'Anh/chị vẫn có thể xem lịch sử đơn đã tạo. Liên hệ NPP phụ trách để kích hoạt đặt hàng.',
  },
};

export function EurohouseFeatureLocked({ featureKey }: { featureKey: EurohouseFeatureKey }) {
  const router = useRouter();
  const content = copy[featureKey];
  return <View style={styles.screen}>
    <AppHeader title={featureKey === 'FORMULA_CUTTING' ? 'Công thức' : 'Đặt hàng nhôm'} subtitle="Quyền truy cập Eurohouse" />
    <View style={styles.card}>
      <View style={styles.icon}><Icon name="lock" size={24} color={colors.brandOrangeText} /></View>
      <Text style={styles.title}>{content.title}</Text>
      <Text style={styles.detail}>{content.detail}</Text>
      <Pressable style={styles.action} onPress={() => router.push('/profile')}>
        <Text style={styles.actionText}>Xem trạng thái tài khoản</Text>
      </Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  card: { margin: 18, padding: 20, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0E5' },
  title: { marginTop: 14, color: colors.brandBlack.main, fontSize: 18, lineHeight: 25, fontWeight: '900', textAlign: 'center' },
  detail: { marginTop: 8, color: colors.brandGrey[500], fontSize: 14, lineHeight: 21, textAlign: 'center' },
  action: { marginTop: 18, borderRadius: 14, backgroundColor: colors.brandOrange, paddingHorizontal: 18, paddingVertical: 12 },
  actionText: { color: colors.brandBlack.main, fontWeight: '900' },
});
