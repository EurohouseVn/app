import { useEffect, useMemo, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { Card, EmptyState, ListRow, Loading, SearchBox, Segmented, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api, assetUrl } from '../src/lib/api';
import { fold } from '../src/lib/invoiceState';

type TabKey = 'PROJECT_IMAGE' | 'DOOR_SAMPLE' | 'SHORT_VIDEO' | 'PRODUCT_CATALOG';

const TABS: Array<[TabKey, string]> = [
  ['PROJECT_IMAGE', 'Dự án'],
  ['DOOR_SAMPLE', 'Mẫu cửa'],
  ['SHORT_VIDEO', 'Video'],
  ['PRODUCT_CATALOG', 'Catalog'],
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

function dateText(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab = TABS.some(([key]) => key === params.tab) ? (String(params.tab) as TabKey) : 'PROJECT_IMAGE';
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    api.get<LibraryItem[]>('/content/library')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => { setLoading(false); setLoaded(true); });
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    if (TABS.some(([key]) => key === params.tab)) setTab(String(params.tab) as TabKey);
  }, [params.tab]);

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    return items.filter((item) => item.categoryId === tab && (!needle || fold(`${item.title} ${item.description ?? ''}`).includes(needle)));
  }, [items, tab, query]);

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
      const downloaded = await FileSystem.downloadAsync(url, `${FileSystem.cacheDirectory}${safeName}.pdf`);
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

  const isCatalog = tab === 'PRODUCT_CATALOG';

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Thư viện" subtitle={loaded ? `Tư liệu Eurohouse · ${items.length} mục` : 'Tư liệu Eurohouse'} onBack={() => router.back()}>
        <Segmented items={TABS} value={tab} onChange={setTab} />
      </SubHeader>
      <ScrollView
        contentContainerStyle={wsStyles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && loaded} onRefresh={loadData} tintColor={ws.orange} />}
      >
        <SearchBox value={query} onChangeText={setQuery} placeholder={isCatalog ? 'Tìm catalog' : 'Tìm dự án, hệ nhôm'} />

        {loading && !loaded ? <Loading /> : null}
        {loaded && visible.length === 0 ? (
          <EmptyState
            icon={isCatalog ? 'file-text' : 'image'}
            title={query ? 'Không có mục khớp' : isCatalog ? 'Chưa có catalog' : 'Chưa có nội dung'}
            text={query ? 'Thử từ khoá khác.' : isCatalog ? 'Catalog mới sẽ hiện ở đây sau khi Eurohouse đăng tải.' : 'Nội dung sẽ được cập nhật trong mục này.'}
          />
        ) : null}

        {isCatalog && visible.length ? (
          <Card padded={false} style={styles.gapTop}>
            {visible.map((item, index) => (
              <ListRow key={item.id} first={index === 0} onPress={downloadingId ? undefined : () => void downloadCatalog(item)} label={`Tải ${item.title}`}>
                <View style={wsStyles.avatar}><Icon name="file-text" size={17} color={ws.orangeText} /></View>
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle} numberOfLines={2}>{item.title}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>{[item.description || 'Catalog sản phẩm Eurohouse', item.createdAt ? `cập nhật ${dateText(item.createdAt)}` : ''].filter(Boolean).join(' · ')}</Text>
                </View>
                {downloadingId === item.id ? <Text style={wsStyles.rowMeta}>Đang tải</Text> : <Icon name="download" size={18} color={ws.muted} />}
              </ListRow>
            ))}
          </Card>
        ) : null}

        {!isCatalog && visible.length ? (
          <View style={styles.grid}>
            {visible.map((item) => {
              const isVideo = item.mediaType === 'VIDEO';
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole={isVideo ? 'button' : undefined}
                  accessibilityLabel={item.title}
                  style={styles.card}
                  onPress={isVideo && item.mediaUrl ? () => Linking.openURL(assetUrl(item.mediaUrl) || '') : undefined}
                >
                  {item.mediaType === 'IMAGE' ? (
                    <Image source={{ uri: assetUrl(item.mediaUrl || '') || '' }} style={styles.cardImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.cardImg, styles.cardIcon]}><Icon name="play-circle" size={30} color={ws.orangeText} /></View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    {item.description ? <Text style={wsStyles.rowMeta} numberOfLines={1}>{item.description}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  card: { width: '48.8%', backgroundColor: ws.surface, borderRadius: 12, borderWidth: 1, borderColor: ws.line, overflow: 'hidden' },
  cardImg: { width: '100%', height: 104, backgroundColor: '#E4E7EC' },
  cardIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: ws.orangeSoft },
  cardBody: { paddingHorizontal: 9, paddingTop: 8, paddingBottom: 10 },
  cardTitle: { color: ws.ink, fontSize: 12.5, lineHeight: 17, fontWeight: '800' },
});
