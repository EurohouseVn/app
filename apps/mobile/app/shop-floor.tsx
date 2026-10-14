import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

type WorkOrder = {
  id: string;
  code: string;
  type: string;
  status: 'DRAFT' | 'READY' | 'IN_PROGRESS' | 'PAUSED' | 'DONE' | 'CANCELLED';
  title: string;
  instructions: string;
  project?: { code: string; name: string };
};

const statusLabel: Record<WorkOrder['status'], string> = {
  DRAFT: 'Bản nháp', READY: 'Sẵn sàng', IN_PROGRESS: 'Đang làm', PAUSED: 'Tạm dừng', DONE: 'Hoàn tất', CANCELLED: 'Đã hủy',
};

export default function ShopFloorScreen() {
  const router = useRouter();
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [issueFor, setIssueFor] = useState<string | null>(null);
  const [issue, setIssue] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await api.get<WorkOrder[]>('/workshop/v2/work-orders'));
    } catch (error) {
      Alert.alert('Không tải được việc hôm nay', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function action(item: WorkOrder, name: 'START' | 'PAUSE' | 'RESUME' | 'DONE') {
    try {
      await api.patch(`/workshop/v2/work-orders/${item.id}/actions/${name}`, {});
      await load();
    } catch (error) {
      Alert.alert('Không cập nhật được', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  }

  async function reportIssue(item: WorkOrder) {
    if (!issue.trim()) return;
    try {
      await api.post(`/workshop/v2/work-orders/${item.id}/issues`, { reason: issue.trim() });
      setIssue('');
      setIssueFor(null);
      Alert.alert('Đã ghi nhận', 'Sự cố đã được gửi cho quản lý xưởng.');
    } catch (error) {
      Alert.alert('Không gửi được', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  }

  const active = items.filter((item) => !['DONE', 'CANCELLED'].includes(item.status));

  return (
    <View style={styles.screen}>
      <AppHeader title="Việc hôm nay" subtitle={`${active.length} công việc đang mở`} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.brandOrange} />}
      >
        {active.length === 0 ? (
          <View style={styles.empty}><Icon name="check-circle" size={34} color={colors.success} /><Text style={styles.emptyTitle}>Không còn việc đang mở</Text><Text style={styles.emptyText}>Kéo xuống để cập nhật danh sách mới.</Text></View>
        ) : active.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}><Text style={styles.code}>{item.code}</Text><Text style={styles.title}>{item.title}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{statusLabel[item.status]}</Text></View>
            </View>
            <Text style={styles.meta}>{item.project ? `${item.project.code} · ${item.project.name}` : item.type.replaceAll('_', ' ')}</Text>
            {item.instructions ? <Text style={styles.instructions}>{item.instructions}</Text> : null}

            <View style={styles.actions}>
              {item.status === 'READY' ? <Pressable style={styles.primary} onPress={() => action(item, 'START')}><Icon name="play" size={18} /><Text style={styles.primaryText}>Bắt đầu</Text></Pressable> : null}
              {item.status === 'IN_PROGRESS' ? <><Pressable style={styles.secondary} onPress={() => action(item, 'PAUSE')}><Icon name="clock" size={18} /><Text style={styles.secondaryText}>Tạm dừng</Text></Pressable><Pressable style={styles.done} onPress={() => action(item, 'DONE')}><Icon name="check" size={18} color={colors.white} /><Text style={styles.doneText}>Hoàn tất</Text></Pressable></> : null}
              {item.status === 'PAUSED' ? <Pressable style={styles.primary} onPress={() => action(item, 'RESUME')}><Icon name="play" size={18} /><Text style={styles.primaryText}>Làm tiếp</Text></Pressable> : null}
              <Pressable accessibilityLabel="Báo sự cố" style={styles.issueButton} onPress={() => setIssueFor(issueFor === item.id ? null : item.id)}><Icon name="alert-circle" size={19} color={colors.danger} /></Pressable>
            </View>

            {issueFor === item.id ? (
              <View style={styles.issueForm}><TextInput value={issue} onChangeText={setIssue} placeholder="Mô tả ngắn sự cố" placeholderTextColor="#94A3B8" style={styles.issueInput} /><Pressable style={styles.issueSend} onPress={() => reportIssue(item)}><Icon name="send" size={17} color={colors.white} /></Pressable></View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' },
  content: { padding: 16, paddingBottom: 110 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900' },
  emptyText: { color: colors.brandGrey[500] },
  card: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: '#E3E7EC', padding: 15, marginBottom: 10 },
  cardTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  code: { color: colors.brandOrangeText, fontSize: 11, fontWeight: '900' },
  title: { color: colors.brandBlack.main, fontSize: 17, fontWeight: '900', marginTop: 3 },
  badge: { backgroundColor: colors.orangeSoft, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: colors.brandOrangeText, fontSize: 10, fontWeight: '800' },
  meta: { color: colors.brandGrey[500], fontSize: 12, marginTop: 8 },
  instructions: { color: colors.brandBlack.main, fontSize: 13, lineHeight: 19, marginTop: 10, backgroundColor: '#F5F7FA', padding: 10, borderRadius: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  primary: { flex: 1, height: 46, backgroundColor: colors.brandOrange, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  primaryText: { color: colors.brandBlack.main, fontWeight: '900' },
  secondary: { flex: 1, height: 46, backgroundColor: '#F1F3F5', borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  secondaryText: { color: colors.brandBlack.main, fontWeight: '800' },
  done: { flex: 1, height: 46, backgroundColor: colors.success, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  doneText: { color: colors.white, fontWeight: '900' },
  issueButton: { width: 46, height: 46, borderRadius: 9, backgroundColor: '#FEECEE', alignItems: 'center', justifyContent: 'center' },
  issueForm: { flexDirection: 'row', gap: 8, marginTop: 10 },
  issueInput: { flex: 1, height: 46, borderWidth: 1, borderColor: '#E0E4E9', borderRadius: 9, paddingHorizontal: 12, color: colors.brandBlack.main },
  issueSend: { width: 46, height: 46, borderRadius: 9, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
});
