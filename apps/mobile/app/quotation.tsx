import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { QuotationInput, QuotationResult } from '@eurohouse/types';
import { Icon } from '../src/components/Icon';
import { api } from '../src/lib/api';

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

export default function QuotationScreen() {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, String(v)])),
  );
  const [result, setResult] = useState<QuotationResult | null>(null);

  async function calc() {
    const payload: QuotationInput = {
      customerName: form.customerName, doorType: form.doorType,
      widthMm: num(form.widthMm), heightMm: num(form.heightMm), quantity: num(form.quantity),
      pricePerM2: num(form.pricePerM2), aluPricePerKg: num(form.aluPricePerKg), glassPerM2: num(form.glassPerM2),
      accessoryCost: num(form.accessoryCost), laborCost: num(form.laborCost), installCost: num(form.installCost),
      profitPct: num(form.profitPct), depreciation: num(form.depreciation),
    };
    const res = await api.post<QuotationResult>('/quotations/calc', payload);
    setResult(res);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F7F8FA' }}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Icon name="chevron-left" size={22} color={colors.white} /></Pressable>
        <Text style={styles.title}>Báo giá tự động</Text>
        <View style={{ width: 38 }} />
      </View>
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

        <Pressable style={styles.calcBtn} onPress={calc}>
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
            <Pressable style={styles.exportBtn}>
              <Icon name="download" size={16} color={colors.brandBlack} />
              <Text style={styles.exportText}>Xuất báo giá (ảnh/excel)</Text>
            </Pressable>
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

const styles = StyleSheet.create({
  topBar: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.brandBlack, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backBtn: { width: 38, height: 38, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontWeight: '900', fontSize: 17 },
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
  exportBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: colors.brandOrange, borderRadius: 14, paddingVertical: 14, marginTop: 16 },
  exportText: { color: colors.brandBlack, fontWeight: '800' },
});
