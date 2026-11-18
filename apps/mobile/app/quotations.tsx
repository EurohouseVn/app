import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { QuotationRecord } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { Button, Card, EmptyState, IconButton, Kpi, KpiRow, ListRow, Loading, SearchBox, SectionHead, SubHeader, ws, wsStyles } from '../src/components/ws';
import { api, API_URL, authHeaders } from '../src/lib/api';
import { compactVnd } from '../src/lib/projectListState';

import { confirmAction, showAlert } from '../src/lib/alert';

function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

export default function QuotationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get<QuotationRecord[]>('/quotations')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => { setLoading(false); setLoaded(true); });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));


  const handleDelete = (id: string) => {
    confirmAction('Xoá báo giá', 'Bạn có chắc chắn muốn xoá báo giá này?', async () => {
      setLoading(true);
      try {
        await api.delete(`/quotations/${id}`);
        setItems(prev => prev.filter(q => q.id !== id && q.code !== id));
      } catch (e) {
        showAlert('Lỗi', 'Không thể xoá báo giá');
      } finally {
        setLoading(false);
      }
    });
  };

  async function exportPdf(q: QuotationRecord, type: 'quotation' | 'estimate') {
    setExportingId(`${q.id}:${type}`);
    try {
      const label = type === 'estimate' ? 'du-toan' : 'bao-gia';
      const target = `${FileSystem.cacheDirectory}${label}-${q.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${q.id}/pdf?type=${type}`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${type === 'estimate' ? 'Dự toán' : 'Báo giá'} ${q.code}` });
      } else {
        Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setExportingId(null);
    }
  }

  const filtered = useMemo(() => {
    const needle = fold(query.trim());
    if (!needle) return items;
    return items.filter((q) => fold(`${q.code} ${q.customerName || ''} ${q.customerPhone || ''}`).includes(needle));
  }, [items, query]);
  const totalValue = items.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCount = items.filter((q) => String(q.createdAt).slice(0, 7) === thisMonth).length;

  return (
    <View style={wsStyles.screen}>
      <SubHeader
        title="Báo giá đã lưu"
        subtitle={loaded ? `${items.length} báo giá` : 'Đang tải...'}
        onBack={() => router.back()}
        right={<IconButton icon="plus" tone="orange" label="Tạo báo giá mới" onPress={() => router.push('/quote')} />}
      />
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {items.length ? (
          <>
            <KpiRow>
              <Kpi label="Tổng báo giá" value={String(items.length)} />
              <Kpi label="Tháng này" value={String(monthCount)} />
              <Kpi label="Tổng giá trị" value={compactVnd(totalValue)} />
            </KpiRow>
            <View style={styles.searchWrap}><SearchBox value={query} onChangeText={setQuery} placeholder="Tìm mã báo giá, khách hàng, SĐT" /></View>
          </>
        ) : null}

        {loading && !loaded ? <Loading /> : null}

        {loaded && items.length === 0 ? (
          <EmptyState
            icon="file-text"
            title="Chưa có báo giá nào"
            text="Tạo báo giá mới để chào khách, xuất PDF và chuyển thành công trình."
            action={<Button label="Tạo báo giá" icon="plus" onPress={() => router.push('/quote')} />}
          />
        ) : null}

        {items.length > 0 && filtered.length === 0 ? <EmptyState icon="search" title="Không có báo giá khớp" text="Thử tìm theo mã báo giá hoặc tên khách." /> : null}

        {filtered.length ? (
          <>
            <SectionHead title="Danh sách" sub={query ? `${filtered.length} kết quả` : 'Mới nhất lên trước'} />
            <Card padded={false}>
              {filtered.map((q, index) => {
                const firstType = q.items?.length ? `${q.items[0].doorType}${q.items.length > 1 ? ` +${q.items.length - 1}` : ''}` : 'Không có hạng mục';
                return (
                  <View key={q.id} style={index > 0 && styles.divider}>
                    <ListRow first onPress={() => router.push({ pathname: '/quotation/[id]', params: { id: q.id } })} label={`Mở báo giá ${q.code}`}>
                      <View style={wsStyles.avatar}><Icon name="file-text" size={17} color={ws.orangeText} /></View>
                      <View style={wsStyles.grow}>
                        <Text style={wsStyles.rowTitle} numberOfLines={1}>{q.customerName || 'Khách lẻ'}</Text>
                        <Text style={wsStyles.rowMeta} numberOfLines={1}>{q.code} · {new Date(q.createdAt).toLocaleDateString('vi-VN')}</Text>
                        <Text style={styles.typeText} numberOfLines={1}>{firstType}</Text>
                      </View>
                      <Text style={styles.total}>{compactVnd(q.totalAmount)}</Text>
                    </ListRow>
                    <View style={styles.actions}>
                      <Pressable style={styles.action} onPress={() => router.push({ pathname: '/quote', params: { id: q.id } })}>
                        <Icon name="edit-2" size={14} color={ws.body} /><Text style={styles.actionText}>Sửa</Text>
                      </Pressable>
                      <Pressable style={[styles.action, exportingId === `${q.id}:quotation` && styles.dim]} disabled={Boolean(exportingId)} onPress={() => exportPdf(q, 'quotation')}>
                        <Icon name="download" size={14} color={ws.body} /><Text style={styles.actionText}>{exportingId === `${q.id}:quotation` ? 'Đang xuất' : 'Báo giá'}</Text>
                      </Pressable>
                      <Pressable style={[styles.action, exportingId === `${q.id}:estimate` && styles.dim]} disabled={Boolean(exportingId)} onPress={() => exportPdf(q, 'estimate')}>
                        <Icon name="file-text" size={14} color={ws.body} /><Text style={styles.actionText}>{exportingId === `${q.id}:estimate` ? 'Đang xuất' : 'Dự toán'}</Text>
                      </Pressable>
                      <Pressable accessibilityLabel={`Xoá báo giá ${q.code}`} style={[styles.action, styles.actionDanger]} onPress={() => handleDelete(q.id)}>
                        <Icon name="trash-2" size={14} color={ws.dangerText} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { marginTop: 10 },
  divider: { borderTopWidth: 1, borderTopColor: ws.line },
  typeText: { color: ws.faint, fontSize: 11, marginTop: 1 },
  total: { color: ws.ink, fontSize: 14, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingBottom: 11 },
  action: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: ws.line, backgroundColor: ws.surface },
  actionDanger: { marginLeft: 'auto', borderColor: '#FECDCA', backgroundColor: ws.dangerBg },
  actionText: { color: ws.body, fontSize: 12, fontWeight: '700' },
  dim: { opacity: 0.55 },
});
