import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { colors } from '@eurohouse/ui';
import type { QuotationInput, QuotationRecord, QuotationResult } from '@eurohouse/types';
import { AppHeader } from '../src/components/AppHeader';
import { Icon } from '../src/components/Icon';
import { api, API_URL, authHeaders } from '../src/lib/api';

const fields: { key: keyof QuotationInput; label: string }[] = [
  { key: 'widthMm', label: 'Chiều rộng (mm)' },
  { key: 'heightMm', label: 'Chiều cao (mm)' },
  { key: 'quantity', label: 'Số lượng bộ' },
  { key: 'pricePerM2', label: 'Đơn giá theo m² (đ)' },
  { key: 'aluPricePerKg', label: 'Đơn giá nhôm (đ/kg)' },
  { key: 'glassPerM2', label: 'Đơn giá kính (đ/m²)' },
  { key: 'accessoryCost', label: 'Phụ kiện (đ)' },
  { key: 'laborCost', label: 'Nhân công sản xuất (đ)' },
  { key: 'installCost', label: 'Chi phí lắp đặt (đ)' },
  { key: 'depreciation', label: 'Khấu hao khác (đ)' },
  { key: 'profitPct', label: 'Lợi nhuận (%)' },
];

const defaults: QuotationInput = {
  customerName: '', doorType: 'Cửa đi 55', widthMm: 1200, heightMm: 2200, quantity: 2,
  pricePerM2: 2800000, aluPricePerKg: 92000, glassPerM2: 320000,
  accessoryCost: 1500000, laborCost: 800000, installCost: 600000, profitPct: 15, depreciation: 200000,
};

function num(v: string): number { return Number(String(v).replace(/[^\d.-]/g, '')) || 0; }

function buildPayload(form: Record<string, string>): QuotationInput {
  return {
    customerName: form.customerName, doorType: form.doorType,
    widthMm: num(form.widthMm), heightMm: num(form.heightMm), quantity: num(form.quantity),
    pricePerM2: num(form.pricePerM2), aluPricePerKg: num(form.aluPricePerKg), glassPerM2: num(form.glassPerM2),
    accessoryCost: num(form.accessoryCost), laborCost: num(form.laborCost), installCost: num(form.installCost),
    profitPct: num(form.profitPct), depreciation: num(form.depreciation),
  };
}

// PLACEHOLDER_COMPONENT
export default function QuoteScreen() {
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, String(v)])),
  );
  const [result, setResult] = useState<QuotationResult | null>(null);
  const [saved, setSaved] = useState<QuotationRecord | null>(null);
  const [busy, setBusy] = useState(false);

  async function calc() {
    setBusy(true);
    try {
      const res = await api.post<QuotationResult>('/quotations/calc', buildPayload(form));
      setResult(res);
      setSaved(null);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không tính được báo giá.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const record = await api.post<QuotationRecord>('/quotations', buildPayload(form));
      setSaved(record);
      Alert.alert('Đã lưu', `Báo giá ${record.code} đã được lưu.`);
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không lưu được báo giá.');
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    if (!saved) return;
    setBusy(true);
    try {
      const target = `${FileSystem.cacheDirectory}bao-gia-${saved.code}.pdf`;
      const { uri } = await FileSystem.downloadAsync(`${API_URL}/quotations/${saved.id}/pdf`, target, {
        headers: authHeaders(),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Báo giá ${saved.code}` });
      } else {
        Alert.alert('Đã tải', `Đã lưu file tại: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không xuất được PDF.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <AppHeader title="Báo giá tự động" subtitle="Nhập thông số và đơn giá để tính báo giá" />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Khách hàng</Text>
            <TextInput value={form.customerName} onChangeText={(v) => setForm((c) => ({ ...c, customerName: v }))} style={styles.input} placeholder="Tên khách" />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Loại cửa</Text>
            <TextInput value={form.doorType} onChangeText={(v) => setForm((c) => ({ ...c, doorType: v }))} style={styles.input} />
          </View>
          {fields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                value={form[f.key as string]}
                onChangeText={(v) => setForm((c) => ({ ...c, [f.key]: v }))}
                keyboardType="numeric"
                style={styles.input}
              />
            </View>
          ))}
        </View>

        <Pressable style={styles.calcBtn} onPress={calc} disabled={busy}>
          <Icon name="zap" size={18} color={colors.brandOrange} />
          <Text style={styles.calcText}>Tính báo giá</Text>
        </Pressable>

        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>Kết quả báo giá</Text>
            <Row label={`Diện tích (${result.areaM2} m²)`} value={result.baseAmount} />
            <Row label="Phụ kiện" value={result.accessoryCost} />
            <Row label="Nhân công" value={result.laborCost} />
            <Row label="Lắp đặt" value={result.installCost} />
            <Row label="Khấu hao" value={result.depreciation} />
            <Row label="Lợi nhuận" value={result.profitAmount} />
            <View style={styles.divider} />
            <Row label="TỔNG BÁO GIÁ" value={result.totalAmount} bold />
            <View style={styles.actionRow}>
              <Pressable style={styles.darkButton} onPress={save} disabled={busy}>
                <Icon name="save" size={16} color={colors.white} />
                <Text style={styles.darkButtonText}>Lưu</Text>
              </Pressable>
              <Pressable style={[styles.orangeButton, !saved && { opacity: 0.5 }]} onPress={exportPdf} disabled={busy || !saved}>
                <Icon name="file-text" size={16} color={colors.brandBlack} />
                <Text style={styles.orangeButtonText}>Xuất PDF</Text>
              </Pressable>
            </View>
            {saved ? <Text style={styles.savedNote}>Đã lưu {saved.code}. Bấm "Xuất PDF" để gửi khách.</Text> : null}
          </View>
        ) : null}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && { fontWeight: '900', color: colors.brandBlack }]}>{label}</Text>
      <Text style={[styles.rowValue, bold && { fontSize: 22, color: colors.brandOrange }]}>{value.toLocaleString('vi-VN')} đ</Text>
    </View>
  );
}
// PLACEHOLDER_STYLES
const styles = StyleSheet.create({
  container: { padding: 18 },
  panel: { backgroundColor: colors.white, borderRadius: 20, padding: 18, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  field: { marginBottom: 12 },
  fieldLabel: { color: colors.brandBlack, fontWeight: '700', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 14, padding: 14, color: colors.brandBlack },
  calcBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack, borderRadius: 999, paddingVertical: 16, marginTop: 16 },
  calcText: { color: colors.brandOrange, fontWeight: '900', fontSize: 16 },
  result: { backgroundColor: colors.white, borderRadius: 20, padding: 18, marginTop: 18, shadowColor: colors.brandBlack, shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  resultTitle: { color: colors.brandBlack, fontWeight: '900', fontSize: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  rowLabel: { color: colors.brandGrey, fontWeight: '700' },
  rowValue: { color: colors.brandBlack, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#EEF0F3', marginVertical: 8 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  darkButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandBlack, borderRadius: 14, paddingVertical: 14 },
  darkButtonText: { color: colors.white, fontWeight: '800' },
  orangeButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 14 },
  orangeButtonText: { color: colors.brandBlack, fontWeight: '800' },
  savedNote: { color: colors.brandGrey, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 },
});
