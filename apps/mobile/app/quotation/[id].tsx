import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { Icon } from '../../src/components/Icon';
import { Banner, Button, Card, EmptyState, Kpi, KpiRow, ListRow, Loading, SectionHead, SubHeader, ValueLine, ws, wsStyles } from '../../src/components/ws';
import { api } from '../../src/lib/api';
import type { QuotationRecord } from '@eurohouse/types';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL, authHeaders } from '../../src/lib/api';

type OptimizeRow = {
  materialCode: string;
  newBarsNeeded: number;
  usedDeXeIds: string[];
  newDeXeGenerated: number[];
  scrapGeneratedKg: number;
};

function kgText(value: number, digits: number): string {
  return `${value.toLocaleString('vi-VN', { minimumFractionDigits: digits, maximumFractionDigits: digits })} kg`;
}

function money(value: number): string {
  return `${Math.round(value || 0).toLocaleString('vi-VN')} đ`;
}

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [q, setQ] = useState<QuotationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<OptimizeRow[] | null>(null);
  const [optError, setOptError] = useState('');
  const [exporting, setExporting] = useState<'quotation' | 'estimate' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get<QuotationRecord>(`/quotations/${id}`)
      .then(setQ)
      .catch(() => Alert.alert('Lỗi', 'Không tìm thấy báo giá.'))
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onOptimizeCut = async () => {
    setOptimizing(true);
    setOptError('');
    try {
      const res = await api.post<OptimizeRow[]>(`/quotations/${id}/optimize`, {});
      setOptResult(Array.isArray(res) ? res : []);
    } catch (e) {
      // Không hiện số liệu thay thế: tối ưu cắt lỗi thì báo lỗi để người dùng thử lại.
      setOptResult(null);
      setOptError(e instanceof Error ? e.message : 'Không tính được tối ưu cắt.');
    } finally {
      setOptimizing(false);
    }
  };

  const exportPdf = async (type: 'quotation' | 'estimate') => {
    if (!q) return;
    setExporting(type);
    try {
      const prefix = type === 'estimate' ? 'du-toan' : 'bao-gia';
      const target = `${FileSystem.cacheDirectory}${prefix}-${q.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${q.id}/pdf?type=${type}`, target, { headers: authHeaders() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${type === 'estimate' ? 'Dự toán' : 'Báo giá'} ${q.code}` });
      } else {
        Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (error) {
      Alert.alert('Lỗi', error instanceof Error ? error.message : 'Không xuất được PDF.');
    } finally {
      setExporting(null);
    }
  };

  const header = <SubHeader title="Chi tiết báo giá" subtitle={q?.code} onBack={() => router.back()} />;

  if (loading && !q) return <View style={wsStyles.screen}><Stack.Screen options={{ headerShown: false }} />{header}<Loading /></View>;
  if (!q) {
    return (
      <View style={wsStyles.screen}>
        <Stack.Screen options={{ headerShown: false }} />
        {header}
        <View style={wsStyles.content}><EmptyState icon="file-text" title="Không tìm thấy báo giá" text="Báo giá có thể đã bị xoá." /></View>
      </View>
    );
  }

  const totalScrap = optResult ? optResult.reduce((s, r) => s + (r.scrapGeneratedKg || 0), 0) : 0;
  const newBars = optResult ? optResult.reduce((s, r) => s + (r.newBarsNeeded || 0), 0) : 0;

  return (
    <View style={wsStyles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      {header}
      <ScrollView contentContainerStyle={wsStyles.content} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={styles.customer}>{q.customerName || 'Khách lẻ'}</Text>
          <Text style={wsStyles.rowMeta}>{[q.customerPhone, q.customerAddress].filter(Boolean).join(' · ') || 'Chưa có thông tin liên hệ'}</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.total}>{money(q.totalAmount)}</Text>
          </View>
          <Text style={wsStyles.rowMeta}>{q.items?.length || 0} hạng mục · lập ngày {new Date(q.createdAt).toLocaleDateString('vi-VN')}</Text>
        </Card>

        <View style={styles.actions}>
          <Button label="Báo giá PDF" icon="download" variant="secondary" loading={exporting === 'quotation'} disabled={Boolean(exporting)} onPress={() => exportPdf('quotation')} style={wsStyles.half} />
          <Button label="Dự toán PDF" icon="file-text" variant="secondary" loading={exporting === 'estimate'} disabled={Boolean(exporting)} onPress={() => exportPdf('estimate')} style={wsStyles.half} />
        </View>
        <View style={styles.actions}>
          <Button label="Sửa báo giá" icon="edit-2" variant="soft" onPress={() => router.push({ pathname: '/quote', params: { id: q.id } })} style={wsStyles.half} />
          <Button label="Sinh hợp đồng" icon="file-text" variant="soft" onPress={() => router.push({ pathname: '/contract', params: { quotationId: q.id } })} style={wsStyles.half} />
        </View>

        {q.items?.length ? (
          <>
            <SectionHead title="Hạng mục" />
            <Card padded={false}>
              {q.items.map((item, index) => (
                <ListRow key={`${item.name}-${index}`} first={index === 0}>
                  <View style={wsStyles.grow}>
                    <Text style={wsStyles.rowTitle} numberOfLines={1}>{item.name} · {item.doorType}</Text>
                    <Text style={wsStyles.rowMeta} numberOfLines={1}>{item.widthMm}×{item.heightMm} mm · SL {item.quantity}{item.system ? ` · ${item.system}` : ''}</Text>
                  </View>
                  {typeof (item as { totalPrice?: number }).totalPrice === 'number' ? <Text style={styles.itemTotal}>{money((item as { totalPrice?: number }).totalPrice ?? 0)}</Text> : null}
                </ListRow>
              ))}
            </Card>
          </>
        ) : null}

        <SectionHead title="Tối ưu cắt nhôm" sub="Số cây cần cắt mới, đề-xê tận dụng và phế liệu dự kiến" />
        {optError ? <View style={styles.gapBottom}><Banner tone="error" title="Chưa tính được tối ưu cắt" text={optError} /></View> : null}
        {!optResult ? (
          <Button label={optError ? 'Thử lại' : 'Bắt đầu tối ưu cắt'} icon="tool" loading={optimizing} onPress={onOptimizeCut} />
        ) : (
          <>
            {optResult.length === 0 ? (
              <EmptyState icon="tool" title="Không có thanh nhôm để tối ưu" text="Báo giá cần gắn công thức cắt hoặc hệ nhôm có mã thanh trong danh mục." />
            ) : (
              <>
              <KpiRow>
                <Kpi label="Cây 6m cần cắt mới" value={`${newBars} cây`} />
                <Kpi label="Phế liệu dự kiến" value={kgText(totalScrap, 1)} tone={totalScrap > 0 ? 'warning' : undefined} />
              </KpiRow>
              <Card padded={false} style={styles.gapTop}>
                {optResult.map((res, idx) => (
                  <View key={`${res.materialCode}-${idx}`} style={idx > 0 && styles.divider}>
                    <ValueLine first label={`Mã nhôm ${res.materialCode}`} value={`${res.newBarsNeeded} cây`} strong />
                    <ValueLine label="Tận dụng đề-xê trong kho" value={`${res.usedDeXeIds?.length ?? 0} đoạn`} />
                    {res.newDeXeGenerated?.length ? <ValueLine label="Đề-xê sinh ra" value={res.newDeXeGenerated.map((x) => `${x / 1000}m`).join(', ')} /> : null}
                    <ValueLine label="Phế liệu" value={kgText(res.scrapGeneratedKg || 0, 2)} tone={res.scrapGeneratedKg > 0 ? 'minus' : undefined} />
                  </View>
                ))}
              </Card>
              </>
            )}
            <View style={styles.gapTop}>
              <Button label="Tính lại" icon="refresh-cw" variant="secondary" loading={optimizing} onPress={onOptimizeCut} />
            </View>
            <View style={styles.note}>
              <Icon name="info" size={14} color={ws.muted} />
              <Text style={styles.noteText}>Đây là phương án tham khảo, chưa trừ kho. Lưu đề-xê vào kho ở màn Công thức sau khi cắt xong.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  customer: { color: ws.ink, fontSize: 17, fontWeight: '900' },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: ws.lineSoft },
  totalLabel: { color: ws.body, fontSize: 13, fontWeight: '800' },
  total: { color: ws.ink, fontSize: 22, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  itemTotal: { color: ws.ink, fontSize: 13, fontWeight: '800' },
  divider: { borderTopWidth: 1, borderTopColor: ws.line },
  gapTop: { marginTop: 10 },
  gapBottom: { marginBottom: 10 },
  note: { flexDirection: 'row', gap: 8, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: ws.line },
  noteText: { flex: 1, color: ws.muted, fontSize: 11.5, lineHeight: 16 },
});
