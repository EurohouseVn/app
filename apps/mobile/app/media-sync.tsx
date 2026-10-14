import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { Icon } from '../src/components/Icon';
import { cancelMedia, listMediaQueue, retryMedia, syncMediaQueue, type MediaQueueItem } from '../src/lib/mediaQueue';

const stateText: Record<MediaQueueItem['uploadState'], string> = {
  PENDING: 'Đang chờ mạng', UPLOADING: 'Đang gửi', UPLOADED: 'Đã gửi', FAILED: 'Gửi chưa thành công', CANCELLED: 'Đã hủy',
};

export default function MediaSyncScreen() {
  const router = useRouter();
  const [items, setItems] = useState<MediaQueueItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => setItems(await listMediaQueue()), []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function refresh() {
    setRefreshing(true);
    await syncMediaQueue();
    await load();
    setRefreshing(false);
  }

  return <View style={styles.screen}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.back}><Icon name="chevron-left" /></Pressable>
      <View><Text style={styles.title}>Ảnh chờ đồng bộ</Text><Text style={styles.subtitle}>{items.filter((item) => !['UPLOADED', 'CANCELLED'].includes(item.uploadState)).length} tệp cần xử lý</Text></View>
    </View>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} contentContainerStyle={styles.content}>
      {items.length === 0 ? <View style={styles.empty}><Icon name="check-circle" size={32} color="#079455" /><Text style={styles.emptyTitle}>Không có ảnh chờ gửi</Text><Text style={styles.muted}>Ảnh chụp ngoại tuyến sẽ xuất hiện tại đây.</Text></View> : items.map((item) => <View key={item.localId} style={styles.card}>
        <View style={styles.row}><View style={styles.icon}><Icon name={item.mime.startsWith('video/') ? 'play-circle' : 'image'} color={colors.brandOrangeText} /></View><View style={{ flex: 1 }}><Text style={styles.name} numberOfLines={1}>{item.fileName}</Text><Text style={styles.muted}>{item.entityType} · {stateText[item.uploadState]}</Text></View></View>
        {item.lastError ? <Text style={styles.error}>Chưa gửi được. Kiểm tra mạng rồi bấm Thử lại.</Text> : null}
        {item.uploadState === 'FAILED' || item.uploadState === 'PENDING' ? <View style={styles.actions}><Pressable style={styles.retry} onPress={async () => { await retryMedia(item.localId); await load(); }}><Icon name="refresh-cw" size={16} /><Text style={styles.actionText}>Thử lại</Text></Pressable><Pressable style={styles.cancel} onPress={async () => { await cancelMedia(item.localId); await load(); }}><Icon name="x" size={16} /><Text style={styles.cancelText}>Hủy</Text></Pressable></View> : null}
      </View>)}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FA' }, header: { paddingTop: 54, paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  back: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#F2F4F7', alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 20, fontWeight: '900', color: colors.brandBlack.main }, subtitle: { color: '#667085', marginTop: 2 }, content: { padding: 16, paddingBottom: 110 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 7 }, emptyTitle: { fontSize: 17, fontWeight: '900' }, muted: { color: '#667085', fontSize: 12 }, card: { backgroundColor: colors.white, borderWidth: 1, borderColor: '#E4E7EC', borderRadius: 10, padding: 14, marginBottom: 9 }, row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, icon: { width: 42, height: 42, borderRadius: 10, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' }, name: { fontWeight: '900', color: colors.brandBlack.main }, error: { marginTop: 10, color: '#B42318', backgroundColor: '#FEF3F2', padding: 9, borderRadius: 7 }, actions: { flexDirection: 'row', gap: 8, marginTop: 10 }, retry: { flex: 1, height: 42, borderRadius: 8, backgroundColor: colors.brandOrange, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, cancel: { flex: 1, height: 42, borderRadius: 8, backgroundColor: '#F2F4F7', flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center' }, actionText: { fontWeight: '900' }, cancelText: { fontWeight: '800', color: '#475467' },
});
