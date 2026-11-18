import { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter, type Href } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PaginatedOrders } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Banner, Button, Card, Chip, EmptyState, IconButton, ListRow, Loading, SubHeader, ws, wsStyles } from '../src/components/ws';
import { confirmAction, showAlert } from '../src/lib/alert';
import { statusText, statusTone } from '../src/lib/orderStatus';
import { useAuth } from '../src/lib/auth';
import { guardEurohouseMutation, orderingScreenPolicy } from '../src/lib/eurohouseFeatureAccess';

type OrderRow = {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  totalKg: number;
  theoreticalTotalKg: number;
  actualTotalKg?: number | null;
  pricingStatus: 'PENDING_NPP' | 'FINALIZED' | 'ESTIMATED_COMPANY';
  createdAt: string;
};

const PAGE_SIZE = 5;
const ORDER_LIMIT = 100;

const filters: { key: string; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'DRAFT', label: 'Nháp' },
  { key: 'NEW', label: 'Mới' },
  { key: 'NPP_REVIEWING', label: 'NPP tiếp nhận' },
  { key: 'SHIPPED', label: 'Đơn giao' },
  { key: 'DELIVERED', label: 'Đã giao' },
  { key: 'COMPLETED', label: 'Hoàn tất' },
];

function dayLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function MyOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const orderingCapability = user?.capabilities.eurohouse.features.EUROHOUSE_ORDERING;
  const orderingPolicy = orderingScreenPolicy(orderingCapability);
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

  const handleDelete = (id: string) => {
    if (!orderingPolicy.canMutate) return;
    confirmAction('Xoá đơn hàng', 'Bạn có chắc chắn muốn xoá đơn hàng này?', async () => {
      setLoading(true);
      try {
        await guardEurohouseMutation(orderingCapability, () => api.delete(`/orders/${id}`));
        load(1, filter);
      } catch {
        showAlert('Lỗi', 'Không thể xoá đơn hàng');
        setLoading(false);
      }
    });
  };

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Đơn hàng của tôi" subtitle={`${total} đơn đã đặt`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {filters.map((f) => <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => changeFilter(f.key)} />)}
        </ScrollView>

        {total >= ORDER_LIMIT ? (
          <Banner tone="warning" icon="zap" text={`Đã đạt giới hạn ${ORDER_LIMIT} đơn lưu trữ, đơn cũ nhất sẽ không còn hiển thị. Nâng cấp gói 89k/tháng để lưu thêm.`} onPress={showUpgradeInfo} />
        ) : null}

        {loading && orders.length === 0 ? <Loading /> : null}
        {!loading && orders.length === 0 ? (
          <EmptyState icon="package" title="Chưa có đơn ở trạng thái này" text="Thử chọn bộ lọc khác." />
        ) : (
          grouped.map((group) => (
            <View key={group.day}>
              <Text style={styles.dayHeader}>{group.day.toUpperCase()}</Text>
              <Card padded={false}>
                {group.items.map((order, index) => {
                  const tone = statusTone[order.status] ?? ws.muted;
                  const kg = order.actualTotalKg ?? order.theoreticalTotalKg ?? order.totalKg;
                  return (
                    <ListRow key={order.id} first={index === 0} onPress={() => router.push(`/order/${order.id}` as Href)} label={`Mở đơn ${order.code}`}>
                      <View style={wsStyles.avatar}><Icon name="package" size={17} color={ws.orangeText} /></View>
                      <View style={wsStyles.grow}>
                        <Text style={wsStyles.rowTitle} numberOfLines={1}>{order.code}</Text>
                        <Text style={wsStyles.rowMeta} numberOfLines={1}>
                          {kg.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} kg · {order.pricingStatus === 'FINALIZED' ? `${order.totalAmount.toLocaleString('vi-VN')} đ` : 'Chờ NPP chốt giá'}
                        </Text>
                      </View>
                      <View style={[styles.status, { backgroundColor: `${tone}1A` }]}><Text style={[styles.statusText, { color: tone }]} numberOfLines={1}>{statusText[order.status] ?? order.status}</Text></View>
                      {orderingPolicy.canMutate && order.status === 'DRAFT' ? (
                        <IconButton icon="trash-2" tone="danger" label={`Xoá đơn ${order.code}`} onPress={() => handleDelete(order.id)} />
                      ) : null}
                    </ListRow>
                  );
                })}
              </Card>
            </View>
          ))
        )}

        {total > 0 ? (
          <View style={styles.pager}>
            <Button label="Trang trước" icon="chevron-left" variant="secondary" disabled={page <= 1} onPress={() => load(page - 1, filter)} style={wsStyles.half} />
            <Text style={styles.pagerInfo}>{page}/{totalPages}</Text>
            <Button label="Trang sau" variant="secondary" disabled={page >= totalPages} onPress={() => load(page + 1, filter)} style={wsStyles.half} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 6, paddingBottom: 10 },
  dayHeader: { color: ws.muted, fontSize: 11.5, fontWeight: '900', letterSpacing: 0.4, marginTop: 12, marginBottom: 6, marginHorizontal: 2 },
  status: { maxWidth: 110, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10.5, fontWeight: '800' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  pagerInfo: { color: ws.body, fontSize: 13, fontWeight: '800', minWidth: 44, textAlign: 'center' },
});
