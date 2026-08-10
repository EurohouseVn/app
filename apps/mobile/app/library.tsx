import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

const tabs: { key: string; label: string }[] = [
  { key: 'PROJECT_IMAGE', label: 'Dự án' },
  { key: 'DOOR_SAMPLE', label: 'Mẫu cửa' },
  { key: 'SHORT_VIDEO', label: 'Video' },
];

export default function LibraryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<string>('PROJECT_IMAGE');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    api.get<any[]>('/content/library').then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const visible = items.filter((item) => item.categoryId === tab);

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Thư viện" subtitle="Mẫu cửa & hình ảnh từ Eurohouse" />
      <ScrollView 
        contentContainerStyle={styles.container} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        <View style={styles.tabRow}>
          {tabs.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={[styles.tab, tab === item.key && styles.tabActive]}>
              <Text style={[styles.tabText, tab === item.key && styles.tabTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {visible.length === 0 && !loading ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="image" size={26} color={colors.brandGrey[500]} /></View>
            <Text style={styles.emptyText}>Chưa có nội dung trong mục này.</Text>
          </View>
        ) : null}

        <View style={styles.grid}>
          {visible.map((item) => (
            <Pressable
              key={item.id}
              style={styles.card}
              onPress={() => item.mediaUrl && item.mediaType === 'VIDEO' && Linking.openURL(assetUrl(item.mediaUrl || '') || '')}
            >
              {item.mediaType === 'IMAGE' ? (
                <Image source={{ uri: assetUrl(item.mediaUrl || '') || '' }} style={styles.cardImg} resizeMode="cover" />
              ) : (
                <View style={styles.cardIcon}><Icon name="play-circle" size={30} color={colors.brandOrange} /></View>
              )}
              <Text style={styles.title}>{item.title}</Text>
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
  tab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.white, shadowColor: colors.brandBlack.main, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  tabActive: { backgroundColor: colors.orangeSoft },
  tabText: { color: colors.brandBlack.main, fontWeight: '700' },
  tabTextActive: { color: colors.brandOrangeText },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: 20, padding: 12, gap: 8, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardImg: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft },
  cardIcon: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.brandBlack.main, fontWeight: '700', fontSize: 13 },
});
