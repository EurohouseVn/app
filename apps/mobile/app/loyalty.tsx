import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { GiftItem } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api } from '../src/lib/api';

const POINTS = 1250;

function giftIcon(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes('khoan')) return 'tool';
  if (n.includes('điện thoại')) return 'smartphone';
  if (n.includes('balo')) return 'shopping-bag';
  if (n.includes('dụng cụ')) return 'tool';
  return 'gift';
}

export default function LoyaltyScreen() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);

  useEffect(() => {
    api.get<GiftItem[]>('/gifts').then(setGifts).catch(() => setGifts([]));
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Đổi quà" subtitle="Loyalty Eurohouse" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.pointsBox}>
          <View style={styles.pointsRow}>
            <View style={styles.starWrap}><Icon name="star" size={22} color={colors.brandBlack} /></View>
            <View>
              <Text style={styles.pointsCaption}>SỐ ĐIỂM HIỆN CÓ</Text>
              <Text style={styles.pointsValue}>{POINTS.toLocaleString('vi-VN')} điểm</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Quà tặng</Text>
        <View style={styles.grid}>
          {gifts.map((gift) => {
            const enough = POINTS >= gift.points;
            return (
              <View key={gift.id} style={styles.card}>
                <View style={styles.iconWrap}><Icon name={giftIcon(gift.name)} size={26} color={colors.brandOrange} /></View>
                <Text style={styles.name}>{gift.name}</Text>
                <Text style={styles.points}>{gift.points.toLocaleString('vi-VN')} điểm</Text>
                <Pressable style={[styles.redeemBtn, !enough && styles.redeemBtnOff]} disabled={!enough}>
                  <Text style={[styles.redeemText, !enough && { color: colors.brandGrey }]}>{enough ? 'Đổi quà' : 'Chưa đủ điểm'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  pointsBox: { backgroundColor: colors.brandOrange, borderRadius: 22, padding: 20, marginBottom: 8 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  starWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.35)', alignItems: 'center', justifyContent: 'center' },
  pointsCaption: { color: colors.brandBlack, fontWeight: '700', fontSize: 12, opacity: 0.8 },
  pointsValue: { color: colors.brandBlack, fontWeight: '900', fontSize: 26, marginTop: 2 },
  sectionTitle: { color: colors.brandBlack, fontSize: 18, fontWeight: '900', marginTop: 22, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: 20, padding: 16, alignItems: 'center', gap: 8, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  iconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.brandBlack, fontWeight: '800' },
  points: { color: colors.brandOrange, fontWeight: '900' },
  redeemBtn: { backgroundColor: colors.brandBlack, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 18, marginTop: 4 },
  redeemBtnOff: { backgroundColor: '#EEF0F3' },
  redeemText: { color: colors.white, fontWeight: '800', fontSize: 12 },
});
