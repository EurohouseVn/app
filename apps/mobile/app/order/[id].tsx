import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../../src/components/AppHeader';
import { Icon } from '../../src/components/Icon';
import { ProfileThumb } from '../../src/components/ProfileThumb';
import { api, API_URL, authHeaders } from '../../src/lib/api';
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
  items: { productCode: string; productName: string; quantity: number; unit: string; totalKg: number; totalPrice: number; profile?: { imageUrl?: string | null } }[];
  histories: { status: string; title: string; note: string; actor: string; createdAt: string }[];
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api.get<OrderDetail>(`/orders/${id}`).then(setOrder).catch((e) => setError(e instanceof Error ? e.message : 'Không tải được đơn hàng.'));
  }, [id]);

  async function exportPdf() {
    if (!order) return;
    setExporting(true);
    try {
      const target = `${FileSystem.cacheDirectory}phieu-dat-hang-${order.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/orders/${order.id}/pdf`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Phiếu ${order.code}` });
      } else {
        Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setExporting(false);
    }
  }

  function displayHistoryActor(event: OrderDetail['histories'][number]) {
    if (event.status === 'NPP_REVIEWING' && order?.nppName) return order.nppName;
    if (event.actor && !event.actor.includes('@')) return event.actor;
    return order?.nppName || event.actor || 'NPP';
  }

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

  const tone = statusTone[order.status] ?? colors.brandGrey[500];

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
            <ProfileThumb imageUrl={item.profile?.imageUrl || undefined} size={44} />
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={[styles.historyTitle, { color: evTone }]}>
                    {statusText[event.status] || event.title}
                  </Text>
                  <Text style={styles.historyTime}>
                    {new Date(event.createdAt).toLocaleDateString('vi-VN')} {new Date(event.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>{event.note} · {displayHistoryActor(event)}</Text>
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

        {order.status === 'DRAFT' ? (
          <Pressable style={styles.editBtn} onPress={() => router.push(`/order/${order.id}/edit` as Href)}>
            <Icon name="edit-2" size={15} color={colors.brandBlack.main} />
            <Text style={styles.editBtnText}>Sửa đơn</Text>
          </Pressable>
        ) : null}

        <Pressable style={[styles.pdfBtn, exporting && { opacity: 0.6 }]} disabled={exporting} onPress={exportPdf}>
          <Icon name="file-text" size={15} color={colors.brandBlack.main} />
          <Text style={styles.pdfBtnText}>{exporting ? 'Đang xuất...' : 'Xuất phiếu PDF'}</Text>
        </Pressable>

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
  totalAmount: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 18 },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 14, marginBottom: 16 },
  cardTitle: { color: colors.brandGrey[500], fontWeight: '800', fontSize: 12, marginBottom: 6, textTransform: 'uppercase' },
  cardLine: { color: colors.brandBlack.main, fontSize: 13, marginTop: 2 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 17, fontWeight: '900', marginTop: 16, marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.white, borderRadius: 16, padding: 12, marginBottom: 8, shadowColor: colors.brandBlack.main, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  itemCode: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14 },
  itemName: { color: colors.brandGrey[500], fontSize: 13, marginTop: 2 },
  itemQty: { color: colors.brandOrangeText, fontWeight: '800', fontSize: 13 },
  itemAmount: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 13, minWidth: 90, textAlign: 'right' },
  historyRow: { flexDirection: 'row', gap: 10, paddingVertical: 8 },
  historyDot: { width: 8, height: 8, borderRadius: 999, marginTop: 5 },
  historyTitle: { fontWeight: '800', fontSize: 13 },
  historyMeta: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  historyTime: { color: colors.brandGrey[500], fontSize: 11, fontWeight: '500' },
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 16, paddingVertical: 14, marginTop: 20 },
  editBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.brandOrange, borderRadius: 16, paddingVertical: 14, marginTop: 10 },
  pdfBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
});
