import { useCallback, useMemo, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { PaginatedOrders } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { statusText, statusTone } from '../src/lib/orderStatus';

type OrderRow = { id: string; code: string; status: string; totalAmount: number; totalKg: number; createdAt: string };

const PAGE_SIZE = 5;
const ORDER_LIMIT = 100;

const filters: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'RECEIVED_BY_NPP', label: 'NPP tiếp nhận' },
  { key: 'PROCESSING', label: 'Đang xử lý' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MyOrdersScreen() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  const load = useCallback((targetPage: number, status: string) => {
    setLoading(true);
    const query = `?page=${targetPage}&pageSize=${PAGE_SIZE}${status !== 'ALL' ? `&status=${status}` : ''}`;
    api.get<PaginatedOrders<OrderRow>>(`/orders${query}`)
      .then((res) => {
        setOrders(res.items);
        setTotal(res.total);
        setPage(res.page);
      })
      .catch(() => { setOrders([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(1, filter); }, [load, filter]));

  function changeFilter(key: string) {
    setFilter(key);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const grouped = useMemo(() => {
    const groups: { day: string; items: OrderRow[] }[] = [];
    for (const order of orders) {
      const day = dayLabel(order.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(order);
      else groups.push({ day, items: [order] });
    }
    return groups;
  }, [orders]);

  function showUpgradeInfo() {
    Alert.alert(
      'Đạt giới hạn lưu trữ',
      `Xưởng của bạn đã đạt ${ORDER_LIMIT} đơn lưu trữ. Đơn cũ nhất sẽ không còn hiển thị trong danh sách (dữ liệu vẫn được giữ nguyên). Vui lòng liên hệ Admin để nâng cấp gói 89.000đ/tháng, tăng hạn mức lưu trữ.`,
      [{ text: 'Đã hiểu' }],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Đơn hàng của tôi" subtitle={`${total} đơn đã đặt`} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => changeFilter(f.key)} style={[styles.filterChip, active && styles.filterChipActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {total >= ORDER_LIMIT ? (
          <Pressable style={styles.limitBanner} onPress={showUpgradeInfo}>
            <Icon name="zap" size={16} color={colors.warning} />
            <Text style={styles.limitBannerText}>
              Đã đạt giới hạn {ORDER_LIMIT} đơn lưu trữ — đơn cũ nhất sẽ không còn hiển thị. Nâng cấp gói 89k/tháng để lưu thêm.
            </Text>
          </Pressable>
        ) : null}

        {!loading && orders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="package" size={24} color={colors.brandGrey} /></View>
            <Text style={styles.emptyText}>Chưa có đơn nào ở trạng thái này.</Text>
          </View>
        ) : (
          grouped.map((group) => (
            <View key={group.day} style={{ marginBottom: 4 }}>
              <Text style={styles.dayHeader}>{group.day}</Text>
              {group.items.map((order) => (
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
              ))}
            </View>
          ))
        )}

        {total > 0 ? (
          <View style={styles.pagerRow}>
            <Pressable
              style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
              disabled={page <= 1}
              onPress={() => load(page - 1, filter)}
            >
              <Icon name="chevron-left" size={16} color={page <= 1 ? colors.brandGrey : colors.brandBlack} />
              <Text style={[styles.pagerText, page <= 1 && { color: colors.brandGrey }]}>Trang trước</Text>
            </Pressable>
            <Text style={styles.pagerInfo}>{page}/{totalPages}</Text>
            <Pressable
              style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
              disabled={page >= totalPages}
              onPress={() => load(page + 1, filter)}
            >
              <Text style={[styles.pagerText, page >= totalPages && { color: colors.brandGrey }]}>Trang sau</Text>
              <Icon name="chevron-right" size={16} color={page >= totalPages ? colors.brandGrey : colors.brandBlack} />
            </Pressable>
          </View>
        ) : null}
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
  limitBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF8E5', borderRadius: 16, padding: 14, marginBottom: 16 },
  limitBannerText: { flex: 1, color: colors.brandBlack, fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey },
  dayHeader: { color: colors.brandGrey, fontWeight: '800', fontSize: 12, marginBottom: 8, marginTop: 6, textTransform: 'uppercase' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandBlack, fontWeight: '900' },
  meta: { color: colors.brandGrey, marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  pagerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  pagerBtnDisabled: { opacity: 0.5 },
  pagerText: { color: colors.brandBlack, fontWeight: '800', fontSize: 12.5 },
  pagerInfo: { color: colors.brandGrey, fontWeight: '700', fontSize: 12.5 },
});
