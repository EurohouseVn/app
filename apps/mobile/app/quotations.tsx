import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import type { QuotationRecord } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api, API_URL, authHeaders } from '../src/lib/api';

import { confirmAction, showAlert } from '../src/lib/alert';

export default function QuotationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<QuotationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<QuotationRecord[]>('/quotations')
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
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

  async function exportPdf(q: QuotationRecord) {
    setExportingId(q.id);
    try {
      const target = `${FileSystem.cacheDirectory}bao-gia-${q.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${q.id}/pdf`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Báo giá ${q.code}` });
      } else {
        Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setExportingId(null);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.brandOrangeText} /></Pressable>
        <Text style={styles.topTitle}>Báo giá đã lưu</Text>
        <Pressable onPress={() => router.push('/quote')} style={styles.addBtn}><Icon name="plus" size={20} color={colors.brandBlack.main} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}><Icon name="file-text" size={26} color={colors.brandGrey[500]} /></View>
            <Text style={styles.emptyText}>Chưa có báo giá nào. Tạo báo giá mới để chào khách.</Text>
            <Pressable style={styles.emptyBtn} onPress={() => router.push('/quote')}>
              <Text style={styles.emptyBtnText}>+ Tạo báo giá</Text>
            </Pressable>
          </View>
        ) : (
          items.map((q) => (
            <View key={q.id} style={styles.card}>
              <View style={styles.cardHead}>
                <View style={styles.cardIcon}><Icon name="file-text" size={18} color={colors.brandOrangeText} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{q.code}</Text>
                  <Text style={styles.meta}>{q.customerName || 'Khách lẻ'} · {q.items?.length || 0} hạng mục</Text>
                </View>
                <Text style={styles.date}>{new Date(q.createdAt).toLocaleDateString('vi-VN')}</Text>
              </View>
              <View style={styles.cardBody}>
                <View>
                  <Text style={styles.bodyLabel}>{q.items?.length ? `${q.items[0].doorType}${q.items.length > 1 ? ', ...' : ''}` : 'Không có hạng mục'}</Text>
                  <Text style={styles.total}>{q.totalAmount.toLocaleString('vi-VN')} đ</Text>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable style={styles.actionBtn} onPress={() => router.push({ pathname: '/quote', params: { id: q.id } })}>
                    <Icon name="edit-2" size={14} color={colors.brandBlack.main} />
                  </Pressable>
                  <Pressable style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => handleDelete(q.id)}>
                    <Icon name="trash-2" size={14} color={colors.danger} />
                  </Pressable>
                  <Pressable style={[styles.pdfBtn, exportingId === q.id && { opacity: 0.6 }]} disabled={exportingId === q.id} onPress={() => exportPdf(q)}>
                    <Icon name="download" size={14} color={colors.brandBlack.main} />
                    <Text style={styles.pdfBtnText}>{exportingId === q.id ? '...' : 'PDF'}</Text>
                  </Pressable>
                </View>

              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16, backgroundColor: colors.orangeSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(217, 92, 0, 0.1)', alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 17 },
  container: { padding: 18, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingVertical: 50, gap: 12 },
  emptyIconWrap: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#EEF0F3', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.brandGrey[500], textAlign: 'center', paddingHorizontal: 30 },
  emptyBtn: { backgroundColor: colors.brandOrange, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12, marginTop: 4 },
  emptyBtnText: { color: colors.brandBlack.main, fontWeight: '900' },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.orangeSoft, alignItems: 'center', justifyContent: 'center' },
  code: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 15 },
  meta: { color: colors.brandGrey[500], fontSize: 12, marginTop: 2 },
  date: { color: colors.brandGrey[500], fontSize: 12 },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEF0F3', paddingTop: 12 },
  bodyLabel: { color: colors.brandGrey[500], fontSize: 12 },
  total: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 18, marginTop: 2 },
  pdfBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.orangeSoft, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  pdfBtnText: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 13 },
  actionBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center' },
});
