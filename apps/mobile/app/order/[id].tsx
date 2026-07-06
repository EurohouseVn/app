import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon } from '../../src/components/Icon';
import { api } from '../../src/lib/api';
import { statusText, statusTone } from '../../src/lib/orderStatus';

type OrderDetail = {
  id: string;
  code: string;
  status: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  nppName: string;
  totalKg: number;
  totalAmount: number;
  note: string;
  accessoriesNote: string;
  items: { productCode: string; productName: string; quantity: number; unit: string; totalKg: number; totalPrice: number }[];
  histories: { status: string; title: string; note: string; actor: string; createdAt: string }[];
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    api.get<OrderDetail>(`/orders/${id}`).then(setOrder).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được đơn hàng.'));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
        <AppHeader title="Chi tiết đơn" />
        <View style={styles.center}><Text style={styles.errorText}>{error}</Text></View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
        <AppHeader title="Chi tiết đơn" />
      </View>
    );
  }

  const tone = statusTone[order.status] ?? colors.brandGrey;

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title={order.code} subtitle={order.nppName ? `Đang xử lý bởi ${order.nppName}` : 'Chờ gán NPP'} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.headRow}>
          <View style={[styles.statusPill, { backgroundColor: tone + '1A' }]}>
            <Text style={[styles.statusPillText, { color: tone }]}>{statusText[order.status] ?? order.status}</Text>
          </View>
          <Text style={styles.totalAmount}>{order.totalAmount.toLocaleString('vi-VN')} đ</Text>
        </View>

        {order.customerName || order.deliveryAddress ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin khách hàng</Text>
            {order.customerName ? <Text style={styles.cardLine}>{order.customerName}{order.customerPhone ? ` · ${order.customerPhone}` : ''}</Text> : null}
            {order.deliveryAddress ? <Text style={styles.cardLine}>{order.deliveryAddress}</Text> : null}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Chi tiết hàng · {order.totalKg.toFixed(1)} kg</Text>
        {order.items.map((item, idx) => (
          <View key={`${item.productCode}-${idx}`} style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemCode}>{item.productCode}</Text>
              <Text style={styles.itemName} numberOfLines={1}>{item.productName}</Text>
            </View>
            <Text style={styles.itemQty}>×{item.quantity}</Text>
            <Text style={styles.itemAmount}>{item.totalPrice.toLocaleString('vi-VN')} đ</Text>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Lịch sử xử lý</Text>
        {order.histories.map((event, idx) => {
          const evTone = statusTone[event.status] ?? colors.brandOrange;
          return (
            <View key={idx} style={styles.historyRow}>
              <View style={[styles.historyDot, { backgroundColor: evTone }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyTitle, { color: evTone }]}>{event.title}</Text>
                <Text style={styles.historyMeta}>{event.note} · {event.actor}</Text>
              </View>
            </View>
          );
        })}

        {order.note ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Ghi chú</Text>
            <Text style={styles.cardLine}>{order.note}</Text>
          </View>
        ) : null}

        {order.accessoriesNote ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Phụ kiện đi kèm</Text>
            <Text style={styles.cardLine}>{order.accessoriesNote}</Text>
          </View>
        ) : null}

        {order.status === 'NEW' ? (
          <Pressable style={styles.editBtn} onPress={() => router.push(`/order/${order.id}/edit` as Href)}>
            <Icon name="edit-2" size={15} color={colors.brandBlack} />
            <Text style={styles.editBtnText}>Sửa đơn</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontWeight: '700' },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statusPill: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
  totalAmount: { color: colors.brandBlack, fontWeight: '900', fontSize: 18 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 16 },
  cardTitle: { color: colors.brandGrey, fontWeight: '800', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  cardLine: { color: colors.brandBlack, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: colors.brandBlack, fontWeight: '900', fontSize: 14, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 12, marginBottom: 8 },
  itemCode: { color: colors.brandBlack, fontWeight: '900', fontSize: 13 },
  itemName: { color: colors.brandGrey, fontSize: 12, marginTop: 2 },
  itemQty: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 13 },
  itemAmount: { color: colors.brandBlack, fontWeight: '800', fontSize: 13, minWidth: 90, textAlign: 'right' },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 999, marginTop: 5 },
  historyTitle: { fontWeight: '800', fontSize: 13 },
  historyMeta: { color: colors.brandGrey, fontSize: 12, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 14, marginTop: 20 },
  editBtnText: { color: colors.brandBlack, fontWeight: '900' },
});
