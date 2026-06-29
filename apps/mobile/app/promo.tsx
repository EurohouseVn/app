import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { Promotion } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

export default function PromoScreen() {
  const router = useRouter();
  const [promo, setPromo] = useState<Promotion | null>(null);

  useEffect(() => {
    api.get<Promotion[]>('/promotions').then((list) => setPromo(list[0] ?? null)).catch(() => undefined);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
        <Text style={styles.topTitle}>Khuyến mãi</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {promo ? (
          <>
            <View style={styles.badge}>
              <Icon name="zap" size={13} color={colors.brandBlack} />
              <Text style={styles.badgeText}>Đang diễn ra</Text>
            </View>
            <Text style={styles.title}>{promo.title}</Text>
            <Text style={styles.subtitle}>{promo.subtitle}</Text>
            <Text style={styles.content}>{promo.content}</Text>
            {promo.gallery.map((img, index) => (
              <Image key={index} source={{ uri: assetUrl(img) }} style={styles.poster} resizeMode="contain" />
            ))}
          </>
        ) : (
          <Text style={{ color: colors.brandGrey }}>Đang tải chương trình...</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.brandBlack, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.white, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 40 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12 },
  badgeText: { color: colors.brandBlack, fontWeight: '800', fontSize: 12 },
  title: { color: colors.brandBlack, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.brandOrange, fontWeight: '800', marginTop: 4 },
  content: { color: colors.brandBlack, lineHeight: 22, marginTop: 12, marginBottom: 16 },
  poster: { width: '100%', height: 460, borderRadius: 18, marginBottom: 14, backgroundColor: colors.orangeSoft },
});
