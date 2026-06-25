import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@eurohouse/ui';
import type { CuttingListItem } from '@eurohouse/types';

const steps = ['Hệ nhôm', 'Kích thước', 'Bảng cắt', 'Phụ kiện', 'Tổng tiền'];

const sampleItems: CuttingListItem[] = [
  { profileCode: 'XF55-K', profileName: 'Khung bao Xingfa 55', lengthMm: 1950, quantity: 2, cutAngle: '45°' },
  { profileCode: 'XF55-C', profileName: 'Cánh mở quay', lengthMm: 2150, quantity: 4, cutAngle: '45°' },
  { profileCode: 'XF55-D', profileName: 'Đố giữa', lengthMm: 900, quantity: 1, cutAngle: '90°' },
];

export default function QuoteScreen() {
  const [width, setWidth] = useState('1200');
  const [height, setHeight] = useState('2200');
  const [quantity, setQuantity] = useState('1');
  const totalKg = useMemo(() => Number(quantity || 1) * 42.6, [quantity]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Tính & Báo giá</Text>
      <Text style={styles.subtitle}>Skeleton wizard. Công thức cắt sẽ lấy từ API, không hard-code trong mobile.</Text>

      <View style={styles.progress}>
        {steps.map((step, index) => (
          <View key={step} style={[styles.step, index === 0 && styles.stepActive]}>
            <Text style={[styles.stepText, index === 0 && styles.stepTextActive]}>{index + 1}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>1. Chọn hệ nhôm / loại cửa</Text>
        <Text style={styles.pill}>Xingfa 55 · Cửa mở quay 2 cánh</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>2. Nhập kích thước</Text>
        <View style={styles.inputRow}>
          <TextInput value={width} onChangeText={setWidth} keyboardType="numeric" style={styles.input} />
          <TextInput value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} />
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={styles.input} />
        </View>
        <Text style={styles.hint}>Rộng × Cao × Số bộ, đơn vị mm.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>3. Bảng cắt mẫu</Text>
        {sampleItems.map((item) => (
          <View key={item.profileCode} style={styles.itemRow}>
            <View>
              <Text style={styles.itemName}>{item.profileName}</Text>
              <Text style={styles.itemMeta}>{item.profileCode} · {item.cutAngle}</Text>
            </View>
            <Text style={styles.itemQty}>{item.lengthMm}mm × {item.quantity}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Tổng kg nhôm tạm tính</Text>
        <Text style={styles.totalValue}>{totalKg.toFixed(1)} kg</Text>
        <Text style={styles.totalLabel}>API kế tiếp: POST /quotes/calculate</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: colors.white },
  title: { color: colors.brandBlack, fontSize: 30, fontWeight: '900' },
  subtitle: { color: colors.brandGrey, marginTop: 8, lineHeight: 22 },
  progress: { flexDirection: 'row', gap: 8, marginVertical: 20 },
  step: { width: 42, height: 8, borderRadius: 999, backgroundColor: colors.orangeSoft },
  stepActive: { backgroundColor: colors.brandOrange },
  stepText: { display: 'none' },
  stepTextActive: { display: 'none' },
  card: { borderColor: colors.orangeSoft, borderWidth: 2, borderRadius: 20, padding: 16, marginBottom: 14 },
  cardTitle: { color: colors.brandBlack, fontSize: 17, fontWeight: '900', marginBottom: 12 },
  pill: { alignSelf: 'flex-start', backgroundColor: colors.orangeSoft, color: colors.brandBlack, fontWeight: '800', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 999, overflow: 'hidden' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, borderColor: colors.brandGrey, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 16, textAlign: 'center' },
  hint: { color: colors.brandGrey, marginTop: 10 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomColor: colors.orangeSoft, borderBottomWidth: 1, paddingVertical: 10, gap: 12 },
  itemName: { color: colors.brandBlack, fontWeight: '800' },
  itemMeta: { color: colors.brandGrey, marginTop: 3 },
  itemQty: { color: colors.brandBlack, fontWeight: '800' },
  totalCard: { backgroundColor: colors.orangeSoft, borderRadius: 22, padding: 20 },
  totalLabel: { color: colors.brandBlack, opacity: 0.72, fontWeight: '700' },
  totalValue: { color: colors.brandBlack, fontSize: 36, fontWeight: '900', marginVertical: 8 },
});
