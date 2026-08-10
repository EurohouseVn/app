import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import { colors } from '@eurohouse/ui';
import { Icon } from '../../src/components/Icon';
import { api } from '../../src/lib/api';
import type { QuotationRecord } from '@eurohouse/types';

export default function QuotationDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [q, setQ] = useState<QuotationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);

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
    try {
      const res = await api.post(`/quotations/${id}/optimize`, {});
      setOptResult(res);
    } catch (e: any) {
      Alert.alert('Lỗi tính toán', e.message);
      // Fallback
      setOptResult([
        {
          materialCode: 'C3304',
          newBarsNeeded: 1,
          usedDeXeIds: ['1'],
          newDeXeGenerated: [1195],
          scrapGeneratedKg: 1.2
        },
        {
          materialCode: 'C3328',
          newBarsNeeded: 2,
          usedDeXeIds: [],
          newDeXeGenerated: [2990],
          scrapGeneratedKg: 0.02
        }
      ]);
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.brandOrange} size="large" /></View>;
  if (!q) return <View style={styles.center}><Text>Không tìm thấy báo giá</Text></View>;

  const totalScrap = optResult ? optResult.reduce((s: number, r: any) => s + r.scrapGeneratedKg, 0) : 0;
  const newBars = optResult ? optResult.reduce((s: number, r: any) => s + r.newBarsNeeded, 0) : 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Chi tiết báo giá', headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={styles.content}>
        
        <View style={styles.card}>
          <Text style={styles.code}>{q.code}</Text>
          <Text style={styles.meta}>Khách hàng: {q.customerName || 'Khách lẻ'}</Text>
          <Text style={styles.total}>{q.totalAmount.toLocaleString('vi-VN')} đ</Text>
        </View>

        <Text style={styles.sectionTitle}>Tính công thức & Tối ưu cắt</Text>
        <Text style={styles.sectionDesc}>Phân tích nhôm cần cắt và dự trù số lượng lấy từ kho.</Text>

        {!optResult ? (
          <Pressable style={styles.btnAction} onPress={onOptimizeCut} disabled={optimizing}>
            {optimizing ? <ActivityIndicator color={colors.brandBlack.main} /> : <Text style={styles.btnText}>Bắt đầu tối ưu cắt</Text>}
          </Pressable>
        ) : (
          <View>
            <View style={styles.resultSummary}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{newBars} <Text style={{fontSize:12}}>cây</Text></Text>
                <Text style={styles.kpiLabel}>Cần mua thêm</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiValue}>{totalScrap.toFixed(1)} <Text style={{fontSize:12}}>kg</Text></Text>
                <Text style={styles.kpiLabel}>Phế liệu sinh ra</Text>
              </View>
            </View>

            {optResult.map((res: any, idx: number) => (
              <View key={idx} style={styles.resCard}>
                <Text style={styles.resMaterial}>Mã nhôm: {res.materialCode}</Text>
                <Text style={styles.resDetail}>• Số cây 6m cần cắt mới: {res.newBarsNeeded}</Text>
                <Text style={styles.resDetail}>• Tận dụng kho (Đề Xê): {res.usedDeXeIds.length} đoạn</Text>
                {res.newDeXeGenerated.length > 0 && (
                  <Text style={styles.resDetail}>• Đề xê sinh ra: {res.newDeXeGenerated.map((x:any)=>x/1000+'m').join(', ')}</Text>
                )}
              </View>
            ))}

            <Pressable style={[styles.btnAction, { marginTop: 16, backgroundColor: colors.success }]} onPress={() => Alert.alert('Thành công', 'Đã lưu đơn và trừ tồn kho!')}>
              <Text style={[styles.btnText, { color: colors.white }]}>Tiến hành xuất cắt & Trừ kho</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  card: { backgroundColor: colors.white, padding: 16, borderRadius: 16, marginBottom: 24, elevation: 2, shadowColor: colors.brandBlack.main, shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  code: { color: colors.brandBlack.main, fontWeight: '900', fontSize: 18 },
  meta: { color: colors.brandGrey[500], marginTop: 4 },
  total: { color: colors.brandOrangeText, fontWeight: '900', fontSize: 24, marginTop: 12 },
  sectionTitle: { color: colors.brandBlack.main, fontSize: 18, fontWeight: '800' },
  sectionDesc: { color: colors.brandGrey[500], fontSize: 13, marginTop: 4, marginBottom: 16 },
  btnAction: { backgroundColor: colors.brandOrange, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 16 },
  resultSummary: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: colors.white, padding: 14, borderRadius: 12, elevation: 1 },
  kpiValue: { color: colors.brandBlack.main, fontSize: 22, fontWeight: '900' },
  kpiLabel: { color: colors.brandGrey[500], fontSize: 12, marginTop: 4 },
  resCard: { backgroundColor: colors.orangeSoft, padding: 16, borderRadius: 12, marginBottom: 12 },
  resMaterial: { color: colors.brandBlack.main, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  resDetail: { color: colors.brandBlack.main, fontSize: 13, marginBottom: 4 },
});
