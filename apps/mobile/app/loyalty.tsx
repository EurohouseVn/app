import { useCallback, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GiftItem, PointLedgerItem, RedeemGiftResult, UserPoints } from '@eurohouse/types';
import { Icon, type IconName } from '../src/components/Icon';
import { api } from '../src/lib/api';
import { Button, Card, EmptyState, SectionHead, SubHeader, ValueLine, ws, wsStyles } from '../src/components/ws';

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
  const d = new Date(value);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function LoyaltyScreen() {
  const router = useRouter();
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
      Alert.alert('Đã đổi quà', `Đã đổi "${res.giftName}". Số điểm còn lại: ${res.pointsBalance.toLocaleString('vi-VN')}.`);
    } catch (e) {
      Alert.alert('Không đổi được quà', e instanceof Error ? e.message : 'Vui lòng thử lại.');
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Đổi quà" subtitle="Điểm thưởng Eurohouse" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.pointsCard}>
          <View style={styles.pointsIcon}><Icon name="star" size={22} color={ws.orangeText} /></View>
          <View style={wsStyles.grow}>
            <Text style={styles.pointsLabel}>Điểm hiện có</Text>
            <Text style={styles.pointsValue}>{points.toLocaleString('vi-VN')} điểm</Text>
          </View>
        </Card>
        <Text style={wsStyles.hint}>Tích 5 điểm cho mỗi 100 kg nhôm Eurohouse đặt qua NPP.</Text>

        <SectionHead title="Quà tặng" />
        {gifts.length === 0 ? <EmptyState icon="gift" title="Chưa có quà để đổi" text="Eurohouse sẽ cập nhật danh sách quà tại đây." /> : (
          <View style={styles.grid}>
            {gifts.map((gift) => {
              const enough = points >= gift.points;
              const busy = redeemingId === gift.id;
              const outOfStock = gift.stock !== undefined && gift.stock !== null && gift.stock <= 0;
              const disabled = !enough || busy || outOfStock;
              return (
                <View key={gift.id} style={styles.gift}>
                  <View style={styles.giftIcon}><Icon name={giftIcon(gift.name)} size={22} color={ws.orangeText} /></View>
                  <Text style={styles.giftName} numberOfLines={2}>{gift.name}</Text>
                  <Text style={styles.giftPoints}>{gift.points.toLocaleString('vi-VN')} điểm</Text>
                  <Button
                    label={outOfStock ? 'Hết hàng' : enough ? 'Đổi quà' : `Thiếu ${(gift.points - points).toLocaleString('vi-VN')}`}
                    variant={disabled ? 'secondary' : 'primary'}
                    loading={busy}
                    disabled={disabled}
                    onPress={() => confirmRedeem(gift)}
                    style={styles.giftButton}
                  />
                </View>
              );
            })}
          </View>
        )}

        <SectionHead title="Lịch sử điểm" />
        {ledger.length === 0 ? <EmptyState icon="clock" title="Chưa có giao dịch điểm" /> : (
          <Card padded={false}>
            {ledger.map((item, index) => (
              <ValueLine
                key={item.id}
                first={index === 0}
                label={reasonLabel[item.reason] ?? item.reason}
                detail={[item.note, formatDate(item.createdAt)].filter(Boolean).join(' · ')}
                value={`${item.delta >= 0 ? '+' : ''}${item.delta.toLocaleString('vi-VN')}`}
                tone={item.delta >= 0 ? 'success' : 'minus'}
              />
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pointsCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBF7', borderColor: ws.orangeLine },
  pointsIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: ws.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  pointsLabel: { color: ws.muted, fontSize: 12, fontWeight: '700' },
  pointsValue: { color: ws.orangeText, fontSize: 24, fontWeight: '900', marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gift: { width: '48.8%', backgroundColor: ws.surface, borderRadius: 12, borderWidth: 1, borderColor: ws.line, padding: 12, alignItems: 'center', gap: 6 },
  giftIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: ws.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  giftName: { color: ws.ink, fontSize: 13, fontWeight: '800', textAlign: 'center', minHeight: 34 },
  giftPoints: { color: ws.orangeText, fontSize: 13, fontWeight: '900' },
  giftButton: { alignSelf: 'stretch', marginTop: 2 },
});
