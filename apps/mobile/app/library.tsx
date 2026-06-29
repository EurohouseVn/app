import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { LibraryItem } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

const tabs: { key: LibraryItem['type']; label: string }[] = [
  { key: 'IMAGE', label: 'Ảnh' },
  { key: 'KNOWLEDGE', label: 'Kiến thức' },
  { key: 'VIDEO', label: 'Video' },
];

const typeIcon: Record<string, IconName> = { IMAGE: 'home', KNOWLEDGE: 'book-open', PRODUCT: 'grid', VIDEO: 'play-circle' };

export default function LibraryScreen() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [tab, setTab] = useState<LibraryItem['type']>('IMAGE');

  useEffect(() => {
    api.get<LibraryItem[]>('/library').then(setItems).catch(() => setItems([]));
  }, []);

  const visible = items.filter((item) => item.type === tab);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Thư viện" subtitle="Mẫu cửa & nội dung từ Eurohouse" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          {tabs.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="image" size={26} color={colors.brandGrey} /></View>
            <Text style={styles.emptyText}>Chưa có nội dung trong mục này.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {visible.map((item) => (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => item.videoUrl && Linking.openURL(item.videoUrl)}
            >
              {item.imageUrl ? (
                <Image source={{ uri: assetUrl(item.imageUrl) }} style={styles.cardImg} resizeMode="cover" />
              ) : (
                <View style={styles.cardIcon}><Icon name={typeIcon[item.type] ?? 'file'} size={30} color={colors.brandOrange} /></View>
              )}
              <Text style={styles.title}>{item.title}</Text>
              {item.tag ? (
                <View style={styles.tagWrap}>
                  {item.type === 'VIDEO' ? <Icon name="play" size={11} color={colors.brandOrange} /> : null}
                  <Text style={styles.tag}>{item.tag}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  tabRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  tab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.white, shadowColor: colors.brandBlack, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tabActive: { backgroundColor: colors.brandBlack },
  tabText: { color: colors.brandBlack, fontWeight: '700' },
  tabTextActive: { color: colors.white },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: 20, padding: 12, gap: 8, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardImg: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft },
  cardIcon: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.brandBlack, fontWeight: '700', fontSize: 13 },
  tagWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tag: { color: colors.brandOrange, fontWeight: '700', fontSize: 11 },
});
