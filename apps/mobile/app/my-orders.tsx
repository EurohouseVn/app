import { useCallback, useMemo, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { statusText, statusTone } from '../src/lib/orderStatus';

type OrderRow = { id: string; code: string; status: string; totalAmount: number; totalKg: number; createdAt: string };

const filters: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'RECEIVED_BY_NPP', label: 'NPP tiếp nhận' },
  { key: 'PROCESSING', label: 'Đang xử lý' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState('ALL');

  const load = useCallback(() => {
    api.get<OrderRow[]>('/orders').then(setOrders).catch(() => setOrders([]));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => (filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)), [orders, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Đơn hàng của tôi" subtitle="Toàn bộ đơn đã đặt" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="package" size={24} color={colors.brandGrey} /></View>
            <Text style={styles.emptyText}>Chưa có đơn nào ở trạng thái này.</Text>
          </View>
        ) : (
          visible.map((order) => (
            <Link key={order.id} href={`/order/${order.id}` as Href} asChild>
              <Pressable style={styles.card}>
                <View style={styles.cardIcon}><Icon name="box" size={18} color={colors.brandOrangeText} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{order.code}</Text>
                  <Text style={styles.meta}>{order.totalKg.toFixed(1)} kg · {order.totalAmount.toLocaleString('vi-VN')} đ</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: (statusTone[order.status] ?? colors.brandGrey) + '1A' }]}>
                  <Text style={[styles.statusPillText, { color: statusTone[order.status] ?? colors.brandBlack }]}>{statusText[order.status] ?? order.status}</Text>
                </View>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 40 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.white },
  filterChipActive: { backgroundColor: colors.brandOrange },
  filterText: { color: colors.brandGrey, fontWeight: '700', fontSize: 12 },
  filterTextActive: { color: colors.brandBlack },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandBlack, fontWeight: '900' },
  meta: { color: colors.brandGrey, marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
});
