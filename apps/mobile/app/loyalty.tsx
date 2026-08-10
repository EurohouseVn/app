import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { GiftItem, PointLedgerItem, RedeemGiftResult, UserPoints } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api } from '../src/lib/api';

function giftIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes('khoan')) return 'tool';
  if (n.includes('điện thoại')) return 'smartphone';
  if (n.includes('balo')) return 'shopping-bag';
  if (n.includes('dụng cụ')) return 'tool';
  return 'gift';
}

const reasonLabel: Record<PointLedgerItem['reason'], string> = {
  WARRANTY: 'Kích hoạt bảo hành',
  ORDER_COMPLETED: 'Đơn hoàn tất',
  ADMIN_ADJUST: 'Điều chỉnh',
  REDEEM: 'Đổi quà',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('vi-VN');
}

export default function LoyaltyScreen() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [points, setPoints] = useState(0);
  const [ledger, setLedger] = useState<PointLedgerItem[]>([]);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<GiftItem[]>('/gifts').then(setGifts).catch(() => setGifts([]));
    api.get<UserPoints>('/me/points')
      .then((p) => { setPoints(p.points); setLedger(p.ledger); })
      .catch(() => { setPoints(0); setLedger([]); });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function confirmRedeem(gift: GiftItem) {
    Alert.alert('Đổi quà', `Dùng ${gift.points.toLocaleString('vi-VN')} điểm để đổi "${gift.name}"?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đổi ngay', onPress: () => redeem(gift) },
    ]);
  }

  async function redeem(gift: GiftItem) {
    setRedeemingId(gift.id);
    try {
      const res = await api.post<RedeemGiftResult>('/gifts/redeem', { giftId: gift.id });
      setPoints(res.pointsBalance);
      load();
      Alert.alert('Thành công', `Đã đổi "${res.giftName}". Số điểm còn lại: ${res.pointsBalance.toLocaleString('vi-VN')}.`);
    } catch (e) {
      Alert.alert('Không đổi được quà', e instanceof Error ? e.message : 'Vui lòng thử lại.');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Đổi quà" subtitle="Loyalty Eurohouse" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.pointsBox}>
          <View style={styles.pointsRow}>
            <View style={styles.starWrap}><Icon name="star" size={22} color={colors.brandBlack.main} /></View>
            <View>
              <Text style={styles.pointsCaption}>SỐ ĐIỂM HIỆN CÓ</Text>
              <Text style={styles.pointsValue}>{points.toLocaleString('vi-VN')} điểm</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quà tặng</Text>
        <View style={styles.grid}>
          {gifts.map((gift) => {
            const enough = points >= gift.points;
            const busy = redeemingId === gift.id;
            const outOfStock = gift.stock !== undefined && gift.stock !== null && gift.stock <= 0;
            const disabled = !enough || busy || outOfStock;
            return (
              <View key={gift.id} style={styles.card}>
                <View style={styles.iconWrap}><Icon name={giftIcon(gift.name)} size={26} color={colors.brandOrange} /></View>
                <Text style={styles.name}>{gift.name}</Text>
                <Text style={styles.points}>{gift.points.toLocaleString('vi-VN')} điểm</Text>
                <Pressable
                  style={[styles.redeemBtn, disabled && styles.redeemBtnOff]}
                  disabled={disabled}
                  onPress={() => confirmRedeem(gift)}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.brandGrey[500]} />
                  ) : (
                    <Text style={[styles.redeemText, disabled && { color: colors.brandGrey[500] }]}>
                      {outOfStock ? 'Hết hàng' : enough ? 'Đổi quà' : 'Chưa đủ điểm'}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Lịch sử điểm</Text>
        {ledger.length === 0 ? (
          <View style={styles.emptyLedger}>
            <Text style={styles.emptyLedgerText}>Chưa có giao dịch điểm nào.</Text>
          </View>
        ) : (
          <View style={styles.ledgerCard}>
            {ledger.map((item, index) => (
              <View key={item.id} style={[styles.ledgerRow, index < ledger.length - 1 && styles.ledgerRowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ledgerReason}>{reasonLabel[item.reason] ?? item.reason}</Text>
                  {item.note ? <Text style={styles.ledgerNote}>{item.note}</Text> : null}
                  <Text style={styles.ledgerDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={[styles.ledgerDelta, { color: item.delta >= 0 ? colors.success : colors.brandOrange }]}>
                  {item.delta >= 0 ? '+' : ''}{item.delta.toLocaleString('vi-VN')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  pointsBox: { backgroundColor: colors.brandOrange, borderRadius: 22, padding: 20, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  starWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  pointsCaption: { color: colors.brandBlack.main, fontWeight: '700', fontSize: 12, opacity: 0.8 },
  pointsValue: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 26, marginTop: 2 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: 20, padding: 16, alignItems: 'center', gap: 8, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  iconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.brandBlack.main, fontWeight: '800' },
  points: { color: colors.brandOrange, fontWeight: '900' },
  redeemBtn: { backgroundColor: colors.brandBlack.main, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18, marginTop: 4 },
  redeemBtnOff: { backgroundColor: '#EEF0F3' },
  redeemText: { color: colors.white, fontWeight: '800', fontSize: 12 },
  ledgerCard: { backgroundColor: colors.white, borderRadius: 18, paddingHorizontal: 16, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  ledgerRowBorder: { borderBottomWidth: 1, borderBottomColor: '#EEF0F3' },
  ledgerReason: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 14 },
  ledgerNote: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  ledgerDate: { color: colors.brandGrey[500], fontSize: 11, marginTop: 2 },
  ledgerDelta: { fontWeight: '900', fontSize: 16 },
  emptyLedger: { backgroundColor: colors.white, borderRadius: 18, padding: 24, alignItems: 'center' },
  emptyLedgerText: { color: colors.brandGrey[500], fontSize: 13 },
});
