import { useCallback, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { Promotion } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

const quickActions: { label: string; icon: IconName; href: Href; bg: string }[] = [
  { label: 'Đặt hàng', icon: 'grid', href: '/orders', bg: '#FFF3DF' },
  { label: 'Báo giá', icon: 'sliders', href: '/quote', bg: '#E8F1FF' },
  { label: 'Quét QR', icon: 'maximize', href: '/warranty', bg: '#E9F8EE' },
  { label: 'Đổi quà', icon: 'gift', href: '/loyalty', bg: '#FFEAEA' },
];

const actionFg: Record<string, string> = {
  'Đặt hàng': colors.brandOrangeText,
  'Báo giá': '#2F6FED',
  'Quét QR': colors.success,
  'Đổi quà': colors.brandRed,
};

type OrderRow = { id: string; code: string; status: string; totalAmount: number; totalKg: number };

const statusText: Record<string, string> = {
  NEW: 'Mới', RECEIVED_BY_NPP: 'NPP tiếp nhận', SENT_TO_ADMIN: 'Gửi công ty',
  PROCESSING: 'Đang xử lý', PARTIAL: 'Giao một phần', COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy',
};

const statusTone: Record<string, string> = {
  NEW: colors.brandOrange, RECEIVED_BY_NPP: colors.success, SENT_TO_ADMIN: colors.brandBlack,
  PROCESSING: colors.warning, PARTIAL: colors.warning, COMPLETED: colors.success, CANCELLED: colors.brandRed,
};

export default function HomeScreen() {
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      api.get<Promotion[]>('/promotions').then((list) => setPromo(list[0] ?? null)).catch(() => undefined);
      api.get<OrderRow[]>('/orders').then(setOrders).catch(() => undefined);
    }, []),
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Eurohouse" subtitle="Nhôm kính của sự thịnh vượng" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Poster khuyến mãi - cập nhật từ Web Admin */}
        {promo ? (
          <Link href="/promo" asChild>
            <Pressable style={styles.poster}>
              <Image source={{ uri: assetUrl(promo.imageUrl) }} style={styles.posterImg} resizeMode="cover" />
              <View style={styles.posterTag}>
                <Icon name="zap" size={12} color={colors.brandBlack} />
                <Text style={styles.posterTagText}>Ưu đãi</Text>
              </View>
            </Pressable>
          </Link>
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Text style={{ color: colors.brandGrey }}>Chưa có chương trình khuyến mãi</Text>
          </View>
        )}

        <View style={styles.actions}>
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} asChild>
              <Pressable style={styles.actionCard}>
                <View style={[styles.actionIconWrap, { backgroundColor: action.bg }]}>
                  <Icon name={action.icon} size={18} color={actionFg[action.label]} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Đơn hàng của tôi</Text>
          <Link href="/orders" style={styles.seeAll}>Đặt thêm</Link>
        </View>

        {orders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="package" size={24} color={colors.brandGrey} />
            </View>
            <Text style={styles.emptyText}>Chưa có đơn nào. Bắt đầu đặt hàng nhôm.</Text>
          </View>
        ) : (
          orders.slice(0, 5).map((order) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderIconWrap}>
                <Icon name="box" size={18} color={colors.brandOrangeText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderCode}>{order.code}</Text>
                <Text style={styles.orderMeta}>{order.totalKg.toFixed(1)} kg · {(order.totalAmount / 1000000).toFixed(1)} tr</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: (statusTone[order.status] ?? colors.brandGrey) + '1A' }]}>
                <Text style={[styles.statusPillText, { color: statusTone[order.status] ?? colors.brandBlack }]}>{statusText[order.status] ?? order.status}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  poster: { height: 158, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.orangeSoft },
  posterImg: { width: '100%', height: '100%' },
  posterEmpty: { alignItems: 'center', justifyContent: 'center' },
  posterTag: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  posterTagText: { color: colors.brandBlack, fontWeight: '800', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  actionCard: { width: '23%', alignItems: 'center', gap: 8 },
  actionIconWrap: { width: 50, height: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { color: colors.brandBlack, fontWeight: '700', fontSize: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 14 },
  sectionTitle: { color: colors.brandBlack, fontSize: 19, fontWeight: '900' },
  seeAll: { color: colors.brandOrangeText, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey },
  orderCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 20, padding: 14, marginBottom: 12, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  orderIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  orderCode: { color: colors.brandBlack, fontWeight: '900' },
  orderMeta: { color: colors.brandGrey, marginTop: 2 },
  statusPill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontWeight: '800', fontSize: 12 },
});
