import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { colors } from '@eurohouse/ui';
import { AppHeader } from '../src/components/AppHeader';
import { Icon, type IconName } from '../src/components/Icon';
import { api, assetUrl } from '../src/lib/api';

const tabs: { key: string; label: string }[] = [
  { key: 'PROJECT_IMAGE', label: 'Dự án' },
  { key: 'DOOR_SAMPLE', label: 'Mẫu cửa' },
  { key: 'SHORT_VIDEO', label: 'Video' },
  { key: 'PRODUCT_CATALOG', label: 'Catalog' },
];

type LibraryItem = {
  id: string;
  title: string;
  description?: string | null;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  categoryId: string;
  createdAt?: string;
};

export default function LibraryScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = tabs.some((item) => item.key === params.tab) ? String(params.tab) : 'PROJECT_IMAGE';
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [tab, setTab] = useState<string>(initialTab);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    api.get<LibraryItem[]>('/content/library').then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tabs.some((item) => item.key === params.tab)) setTab(String(params.tab));
  }, [params.tab]);

  const visible = items.filter((item) => item.categoryId === tab);

  const downloadCatalog = async (item: LibraryItem) => {
    const url = assetUrl(item.mediaUrl || '');
    if (!url) return;
    try {
      setDownloadingId(item.id);
      if (Platform.OS === 'web') {
        await Linking.openURL(url);
        return;
      }
      const safeName = item.title.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'catalog-eurohouse';
      const target = `${FileSystem.cacheDirectory}${safeName}.pdf`;
      const downloaded = await FileSystem.downloadAsync(url, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloaded.uri, { mimeType: 'application/pdf', dialogTitle: 'Lưu catalog Eurohouse' });
      } else {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert('Không tải được catalog', 'Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Thư viện" subtitle="Catalog, mẫu cửa & tư liệu Eurohouse" />
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
            <View style={styles.emptyIconWrap}>
              <Icon name={tab === 'PRODUCT_CATALOG' ? 'file-text' : 'image'} size={26} color={tab === 'PRODUCT_CATALOG' ? colors.brandOrange : colors.brandGrey[500]} />
            </View>
            <Text style={styles.emptyTitle}>{tab === 'PRODUCT_CATALOG' ? 'Chưa có catalog' : 'Chưa có nội dung'}</Text>
            <Text style={styles.emptyText}>{tab === 'PRODUCT_CATALOG' ? 'Catalog mới sẽ hiển thị tại đây sau khi WebAdmin đăng tải.' : 'Nội dung sẽ được cập nhật trong mục này.'}</Text>
          </View>
        ) : null}

        {tab === 'PRODUCT_CATALOG' ? (
          <View style={styles.catalogList}>
            {visible.map((item) => (
              <View key={item.id} style={styles.catalogCard}>
                <View style={styles.catalogIcon}><Icon name="file-text" size={24} color={colors.brandOrange} /></View>
                <View style={styles.catalogCopy}>
                  <Text style={styles.catalogTitle}>{item.title}</Text>
                  <Text style={styles.catalogDesc} numberOfLines={2}>{item.description || 'Catalog sản phẩm Eurohouse'}</Text>
                  {item.createdAt ? <Text style={styles.catalogDate}>Cập nhật {new Date(item.createdAt).toLocaleDateString('vi-VN')}</Text> : null}
                </View>
                <Pressable
                  style={styles.downloadButton}
                  disabled={downloadingId === item.id}
                  onPress={() => void downloadCatalog(item)}
                >
                  <Icon name="download" size={17} color={colors.brandOrangeText} />
                  <Text style={styles.downloadText}>{downloadingId === item.id ? 'Đang tải' : 'Tải PDF'}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
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
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 110 },
  tabRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  tab: { minWidth: '22%', flexGrow: 1, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E7E9ED' },
  tabActive: { backgroundColor: colors.orangeSoft },
  tabText: { color: colors.brandBlack.main, fontWeight: '700' },
  tabTextActive: { color: colors.brandOrangeText },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 8, paddingHorizontal: 24 },
  emptyIconWrap: { width: 64, height: 64, borderRadius: 22, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  emptyText: { color: colors.brandGrey[500], textAlign: 'center', fontSize: 12, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: 20, padding: 12, gap: 8, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardImg: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft },
  cardIcon: { width: '100%', height: 110, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.brandBlack.main, fontWeight: '700', fontSize: 13 },
  catalogList: { gap: 12 },
  catalogCard: { backgroundColor: colors.white, borderRadius: 18, borderWidth: 1, borderColor: '#E7E9ED', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  catalogIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  catalogCopy: { flex: 1, minWidth: 170 },
  catalogTitle: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 14, lineHeight: 19 },
  catalogDesc: { color: colors.brandGrey[500], fontSize: 12, lineHeight: 17, marginTop: 2 },
  catalogDate: { color: colors.brandGrey[500], fontSize: 10.5, marginTop: 5 },
  downloadButton: { minHeight: 38, borderRadius: 10, backgroundColor: colors.orangeSoft, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  downloadText: { color: colors.brandOrangeText, fontSize: 12, fontWeight: '900' },
});
