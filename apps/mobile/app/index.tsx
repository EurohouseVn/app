import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { Promotion } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';
import { useAuth } from '../src/lib/auth';
import { statusText, statusTone } from '../src/lib/orderStatus';

const quickActions: { label: string; icon: IconName; href: Href; bg: string }[] = [
  { label: 'Báo giá', icon: 'sliders', href: '/quote', bg: '#FFFFFF' },
  { label: 'Tồn kho', icon: 'box', href: '/inventory', bg: '#FFFFFF' },
  { label: 'Quét QR', icon: 'maximize', href: '/warranty', bg: '#FFFFFF' },
  { label: 'Đổi quà', icon: 'gift', href: '/loyalty', bg: '#FFFFFF' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

const actionFg: Record<string, string> = {
  'Báo giá': '#2F6FED',
  'Tồn kho': colors.brandOrangeText,
  'Quét QR': colors.success,
  'Đổi quà': colors.brandRed.main,
};

type OrderRow = { id: string; code: string; status: string; totalAmount: number; totalKg: number };

const ACTIVE_STATUSES = [
  'NEW', 'NPP_REVIEWING', 'CONFIRMED', 'RESERVED', 'PICKING', 'SHIPPED', 'PARTIALLY_SHIPPED',
  'RECEIVED_BY_NPP', 'SENT_TO_ADMIN', 'PROCESSING', 'PARTIAL',
];

export default function HomeScreen() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<Promotion[]>([]);
  const [promoIndex, setPromoIndex] = useState(0);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const promoGalleryRef = useRef<ScrollView>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      const audience = user?.role === 'NPP' || user?.role === 'DAILY' ? 'NPP_DEALER' : 'WORKER';
      api.get<Promotion[]>(`/content/promotions?audience=${audience}`).then((list) => {
        setPromos(list);
        setPromoIndex(0);
      }).catch(() => undefined);
      api.get<OrderRow[]>('/orders').then(setOrders).catch(() => undefined);
    }, [user]),
  );

  useEffect(() => {
    if (promos.length <= 1) return undefined;
    const timer = setInterval(() => setPromoIndex((cur) => (cur + 1) % promos.length), 5000);
    return () => clearInterval(timer);
  }, [promos.length]);

  const promo = promos[promoIndex] ?? null;
  const modalImages = useMemo(() => {
    if (!selectedPromo) return [];
    const gallery = Array.isArray(selectedPromo.gallery) && selectedPromo.gallery.length > 0 ? selectedPromo.gallery : [];
    return gallery.length ? gallery : selectedPromo.imageUrl ? [selectedPromo.imageUrl] : [];
  }, [selectedPromo]);

  function openPromo(promotion: Promotion) {
    setSelectedPromo(promotion);
    setSelectedImageIndex(0);
  }

  function changeModalImage(delta: number) {
    if (modalImages.length === 0) return;
    const next = (selectedImageIndex + delta + modalImages.length) % modalImages.length;
    setSelectedImageIndex(next);
    promoGalleryRef.current?.scrollTo({ x: next * SCREEN_WIDTH, animated: true });
  }

  const activeCount = orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length;
  const totalKg = orders.reduce((s, o) => s + o.totalKg, 0);
  const totalAmount = orders.reduce((s, o) => s + o.totalAmount, 0);
  return (
    <View style={{ flex: 1, backgroundColor: colors.brandGrey[50] || '#FAFAFA' }}>
      <AppHeader title="Eurohouse" subtitle="Nhôm kính của sự thịnh vượng" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Poster khuyến mãi - cập nhật từ Web Admin */}
        {promo ? (
          <Pressable style={styles.poster} onPress={() => openPromo(promo)}>
            {promo.imageUrl ? <Image source={{ uri: assetUrl(promo.imageUrl) }} style={styles.posterImg} resizeMode="cover" /> : null}
            <View style={styles.posterTag}>
              <Icon name="zap" size={12} color={colors.brandBlack.main} />
              <Text style={styles.posterTagText}>Ưu đãi</Text>
            </View>
            {promos.length > 1 ? (
              <View style={styles.posterDots}>
                {promos.map((item, index) => <View key={item.id} style={[styles.posterDot, index === promoIndex && styles.posterDotActive]} />)}
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <Text style={{ color: colors.brandGrey[500] }}>Chưa có chương trình khuyến mãi</Text>
          </View>
        )}

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{activeCount}</Text>
            <Text style={styles.kpiLabel}>Đơn đang xử lý</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{totalKg.toFixed(0)}<Text style={styles.kpiUnit}> kg</Text></Text>
            <Text style={styles.kpiLabel}>Tổng khối lượng</Text>
          </View>
          <View style={[styles.kpiCard, { backgroundColor: colors.orangeSoft, borderColor: colors.brandOrange, borderWidth: 1 }]}>
            <Text style={[styles.kpiValue, { color: colors.brandOrangeText }]}>{(totalAmount / 1000000).toFixed(1)}<Text style={styles.kpiUnit}> tr</Text></Text>
            <Text style={[styles.kpiLabel, { color: colors.brandBlack.main }]}>Tổng giá trị</Text>
          </View>
        </View>

        <Link href="/loyalty" asChild>
          <Pressable style={styles.loyaltyBanner}>
            <View style={styles.loyaltyIcon}>
              <Icon name="award" size={24} color={colors.brandOrangeText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.loyaltyTitle}>Xem điểm tích luỹ</Text>
              <Text style={styles.loyaltyDesc}>Đổi hàng ngàn quà tặng hấp dẫn</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.brandOrangeText} />
          </Pressable>
        </Link>

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
          <Link href="/my-orders" style={styles.seeAll}>Xem tất cả</Link>
        </View>

        {orders.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Icon name="package" size={24} color={colors.brandGrey[500]} />
            </View>
            <Text style={styles.emptyText}>Chưa có đơn nào. Bắt đầu đặt hàng nhôm.</Text>
          </View>
        ) : (
          orders.slice(0, 5).map((order) => (
            <Link key={order.id} href={`/order/${order.id}` as Href} asChild>
              <Pressable style={styles.orderCard}>
                <View style={styles.orderIconWrap}>
                  <Icon name="box" size={18} color={colors.brandOrangeText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderCode}>{order.code}</Text>
                  <Text style={styles.orderMeta}>{order.totalKg.toFixed(1)} kg · {(order.totalAmount / 1000000).toFixed(1)} tr</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: (statusTone[order.status] ?? colors.brandGrey[500]) + '1A' }]}>
                  <Text style={[styles.statusPillText, { color: statusTone[order.status] ?? colors.brandBlack.main }]}>{statusText[order.status] ?? order.status}</Text>
                </View>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>

      <Modal visible={!!selectedPromo} transparent animationType="fade" onRequestClose={() => setSelectedPromo(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalClose} onPress={() => setSelectedPromo(null)}>
            <Icon name="x" size={22} color={colors.white} />
          </Pressable>
          {modalImages.length > 0 ? (
            <View style={styles.modalBody}>
              <ScrollView
                ref={promoGalleryRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => setSelectedImageIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              >
                {modalImages.map((image) => (
                  <Image key={image} source={{ uri: assetUrl(image) }} style={styles.modalImage} resizeMode="contain" />
                ))}
              </ScrollView>
              {modalImages.length > 1 ? (
                <View style={styles.modalControls}>
                  <Pressable style={styles.modalArrow} onPress={() => changeModalImage(-1)}>
                    <Icon name="chevron-left" size={22} color={colors.white} />
                  </Pressable>
                  <Text style={styles.modalCount}>{selectedImageIndex + 1}/{modalImages.length}</Text>
                  <Pressable style={styles.modalArrow} onPress={() => changeModalImage(1)}>
                    <Icon name="chevron-right" size={22} color={colors.white} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  poster: { height: 158, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.white },
  posterImg: { width: '100%', height: '100%' },
  posterEmpty: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.brandGrey[200], borderStyle: 'dashed' },
  posterTag: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  posterTagText: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 12 },
  posterDots: { position: 'absolute', left: 0, right: 0, bottom: 12, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  posterDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.55)' },
  posterDotActive: { width: 18, backgroundColor: colors.white },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  modalClose: { position: 'absolute', top: 48, right: 18, zIndex: 5, width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  modalBody: { flex: 1, justifyContent: 'center', paddingHorizontal: 12 },
  modalImage: { width: SCREEN_WIDTH, height: '78%' },
  modalControls: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  modalArrow: { width: 48, height: 48, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  modalCount: { color: colors.white, fontWeight: '800', minWidth: 54, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 12, gap: 4, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  kpiValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 22 },
  kpiUnit: { fontSize: 12, fontWeight: '600', color: colors.brandGrey[500] },
  kpiLabel: { color: colors.brandGrey[500], fontWeight: '700', fontSize: 11 },
  loyaltyBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, padding: 14, borderRadius: 16, marginTop: 16, shadowColor: colors.brandBlack.main, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  loyaltyIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  loyaltyTitle: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 14 },
  loyaltyDesc: { color: colors.brandOrangeText, fontSize: 12, marginTop: 2, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  actionCard: { flex: 1, minWidth: '45%', backgroundColor: colors.white, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  actionIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: colors.brandBlack.main, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
  actionLabel: { color: colors.brandBlack.main, fontWeight: '700', fontSize: 14, flex: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 12 },
  sectionTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 17 },
  seeAll: { color: colors.brandOrange, fontWeight: '700', fontSize: 13 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12, backgroundColor: colors.white, borderRadius: 20 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FAFAFA', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500], fontSize: 13 },
  orderCard: { backgroundColor: colors.white, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, shadowColor: colors.brandBlack.main, shadowOpacity: 0.03, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  orderIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  orderCode: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 14 },
  orderMeta: { color: colors.brandGrey[500], fontSize: 12, marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusPillText: { fontWeight: '800', fontSize: 11 },
});
