import { useCallback, useMemo, useState } from 'react';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { Banner, Card, Chip, EmptyState, ListRow, Loading, SearchBox, Sheet, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api, assetUrl } from '../src/lib/api';
import { fold } from '../src/lib/invoiceState';

type CategoryId = 'ALL' | 'CUTTING_GUIDE' | 'CONSTRUCTION_GUIDE' | 'PRODUCT_INFO' | 'CREATIVE_GUIDE';

const CATEGORIES: Array<[CategoryId, string]> = [
  ['ALL', 'Tất cả'],
  ['CUTTING_GUIDE', 'Cắt nhôm'],
  ['CONSTRUCTION_GUIDE', 'Thi công'],
  ['PRODUCT_INFO', 'Sản phẩm'],
  ['CREATIVE_GUIDE', 'Mẹo hay'],
];

type Article = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string | null;
  categoryId: Exclude<CategoryId, 'ALL'>;
  aluSystem?: { name?: string } | null;
  updatedAt?: string;
};

function categoryName(id: string): string {
  return CATEGORIES.find(([key]) => key === id)?.[1] ?? 'Kỹ thuật';
}

/** Ước lượng phút đọc: khoảng 200 chữ mỗi phút. */
function readMinutes(content: string): number {
  return Math.max(1, Math.round(content.trim().split(/\s+/).length / 200));
}

export default function KnowledgeScreen() {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState<CategoryId>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Article | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setArticles(await api.get<Article[]>('/content/knowledge'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được bài viết.');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadData(); }, [loadData]));

  const visible = useMemo(() => {
    const needle = fold(query.trim());
    return articles.filter((a) => (category === 'ALL' || a.categoryId === category) && (!needle || fold(`${a.title} ${a.content}`).includes(needle)));
  }, [articles, category, query]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map(([key]) => [key, key === 'ALL' ? articles.length : articles.filter((a) => a.categoryId === key).length])), [articles]);

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <SubHeader title="Kiến thức" subtitle="Cẩm nang, hướng dẫn cắt và thi công" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={wsStyles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={loading && loaded} onRefresh={() => void loadData()} tintColor={ws.orange} />}
      >
        <SearchBox value={query} onChangeText={setQuery} placeholder="Tìm bài viết, hệ nhôm" />
        <View style={styles.categoryGrid}>
          {CATEGORIES.map(([key, label]) => <Chip key={key} label={label} count={counts[key]} active={category === key} onPress={() => setCategory(key)} />)}
        </View>

        {error ? <Banner tone="error" title="Chưa tải được" text={error} onPress={() => void loadData()} /> : null}
        {loading && !loaded ? <Loading /> : null}
        {loaded && !error && visible.length === 0 ? (
          <EmptyState
            icon="book-open"
            title={articles.length ? 'Không có bài khớp' : 'Chưa có bài viết'}
            text={articles.length ? 'Thử chọn mục khác hoặc đổi từ khoá.' : 'Eurohouse sẽ đăng cẩm nang cắt nhôm và thi công tại đây.'}
          />
        ) : null}

        {visible.length ? (
          <Card padded={false}>
            {visible.map((article, index) => (
              <ListRow key={article.id} first={index === 0} onPress={() => setOpen(article)} label={`Đọc ${article.title}`}>
                {article.imageUrl ? (
                  <Image source={{ uri: assetUrl(article.imageUrl) || article.imageUrl }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[wsStyles.avatar, styles.thumbIcon]}><Icon name="book-open" size={17} color={ws.orangeText} /></View>
                )}
                <View style={wsStyles.grow}>
                  <Text style={wsStyles.rowTitle} numberOfLines={2}>{article.title}</Text>
                  <Text style={wsStyles.rowMeta} numberOfLines={1}>
                    {[categoryName(article.categoryId), article.aluSystem?.name, `${readMinutes(article.content)} phút đọc`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Icon name="chevron-right" size={17} color={ws.faint} />
              </ListRow>
            ))}
          </Card>
        ) : null}
      </ScrollView>

      <Sheet visible={Boolean(open)} onClose={() => setOpen(null)} title={open?.title ?? ''} sub={open ? `${categoryName(open.categoryId)} · ${readMinutes(open.content)} phút đọc` : undefined} tall>
        {open?.imageUrl ? <Image source={{ uri: assetUrl(open.imageUrl) || open.imageUrl }} style={styles.cover} resizeMode="cover" /> : null}
        <Text style={styles.body}>{open?.content}</Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#E4E7EC' },
  thumbIcon: { width: 44, height: 44 },
  cover: { width: '100%', height: 170, borderRadius: 12, backgroundColor: '#E4E7EC', marginBottom: 12 },
  body: { color: ws.text, fontSize: 14, lineHeight: 22 },
});
